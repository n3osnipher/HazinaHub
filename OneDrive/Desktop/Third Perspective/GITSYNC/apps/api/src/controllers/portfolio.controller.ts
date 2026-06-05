import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { initiateB2C } from '../services/mpesa.service';

export const getPortfolioSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Total invested and current values
    const summaryResult = await query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_invested,
        COALESCE(SUM(current_value), 0) as current_value,
        COALESCE(SUM(accrued_interest), 0) as total_returns
       FROM investments WHERE user_id = $1 AND status IN ('active', 'matured')`,
      [userId]
    );

    const totalInvested = parseFloat(summaryResult.rows[0].total_invested);
    const currentValue = parseFloat(summaryResult.rows[0].current_value);
    const totalReturns = parseFloat(summaryResult.rows[0].total_returns);
    const yieldPercentage = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    // Growth data (last 30 days from portfolio snapshots)
    const growthResult = await query(
      `SELECT snapshot_date as date, current_value as value
       FROM portfolio_snapshots
       WHERE user_id = $1 AND snapshot_date >= CURRENT_DATE - interval '30 days'
       ORDER BY snapshot_date ASC`,
      [userId]
    );

    // Withdrawal eligible (matured investments)
    const withdrawResult = await query(
      `SELECT COALESCE(SUM(current_value), 0) as eligible
       FROM investments 
       WHERE user_id = $1 AND status = 'matured'`,
      [userId]
    );

    // Active investments with fund details
    const investmentsResult = await query(
      `SELECT i.*, f.name as fund_name, f.provider, f.interest_rate, f.risk_level
       FROM investments i
       JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1 AND i.status IN ('active', 'matured')
       ORDER BY i.current_value DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        totalInvested,
        currentValue,
        totalReturns,
        yieldPercentage: Math.round(yieldPercentage * 100) / 100,
        withdrawalEligible: parseFloat(withdrawResult.rows[0].eligible),
        growthData: growthResult.rows.map((g: Record<string, unknown>) => ({
          date: g.date,
          value: parseFloat(g.value as string),
        })),
        investments: investmentsResult.rows.map((i: Record<string, unknown>) => ({
          id: i.id,
          fundName: i.fund_name,
          provider: i.provider,
          amount: parseFloat(i.amount as string),
          currentValue: parseFloat(i.current_value as string),
          accruedInterest: parseFloat(i.accrued_interest as string),
          interestRate: parseFloat(i.interest_rate as string),
          riskLevel: i.risk_level,
          status: i.status,
          investedAt: i.invested_at,
          maturesAt: i.matures_at,
        })),
      },
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ success: false, error: 'Failed to load portfolio' });
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { investmentId, amount } = req.body;

    // Verify investment belongs to user and is eligible
    const investResult = await query(
      `SELECT i.*, f.name as fund_name FROM investments i
       JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.id = $1 AND i.user_id = $2 AND i.status = 'matured'`,
      [investmentId, req.userId]
    );

    if (investResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Investment not eligible for withdrawal' });
      return;
    }

    const investment = investResult.rows[0];
    const maxWithdraw = parseFloat(investment.current_value);

    if (amount > maxWithdraw) {
      res.status(400).json({ success: false, error: `Maximum withdrawal is KES ${maxWithdraw.toLocaleString()}` });
      return;
    }

    // Create withdrawal transaction
    const userResult = await query('SELECT phone FROM users WHERE id = $1', [req.userId]);
    const phone = userResult.rows[0]?.phone;

    await query(
      `INSERT INTO transactions (user_id, type, amount, phone, status, description)
       VALUES ($1, 'withdrawal', $2, $3, 'pending', $4)`,
      [req.userId, amount, phone, `Withdrawal from ${investment.fund_name}`]
    );

    // Trigger M-Pesa B2C
    try {
      console.log(`💸 Initiating B2C payout: KES ${amount} to ${phone}`);
      await initiateB2C({
        phone: phone,
        amount: amount,
        remarks: `Withdrawal from ${investment.fund_name}`,
      });
    } catch (e: any) {
      console.error('B2C Payout Initiation Failed:', e.message);
      // We don't fail the request here, as the withdrawal is already recorded in DB as 'pending'
    }

    // Update investment
    const newValue = maxWithdraw - amount;
    if (newValue <= 0) {
      await query(
        `UPDATE investments SET status = 'withdrawn', current_value = 0, withdrawn_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [investmentId]
      );
    } else {
      await query(
        `UPDATE investments SET current_value = $1, updated_at = NOW() WHERE id = $2`,
        [newValue, investmentId]
      );
    }

    res.json({
      success: true,
      data: { message: `Withdrawal of KES ${amount.toLocaleString()} initiated from ${investment.fund_name}` },
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, error: 'Withdrawal failed' });
  }
};
