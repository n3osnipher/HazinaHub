import { Response } from 'express';
import { validationResult } from 'express-validator';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { initiateSTKPush } from '../services/mpesa.service';

import { MmfFund } from '../models/MmfFund';

export const getAvailableFunds = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const funds = await MmfFund.find({ isActive: true }).sort({ interestRate: -1 });

    res.json({
      success: true,
      data: funds.map(f => ({
        id: f._id,
        name: f.name,
        provider: f.provider,
        interestRate: f.interestRate,
        minimumInvestment: f.minimumInvestment,
        riskLevel: f.riskLevel,
        maturityDays: f.maturityDays,
        totalAum: f.totalAum,
        description: f.description,
        websiteUrl: f.websiteUrl || '',
      })),
    });
  } catch (error) {
    console.error('Get funds error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch funds' });
  }
};

export const investInFund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { fundId, amount, phone } = req.body;

    // Validate fund exists
    const fundResult = await query('SELECT * FROM mmf_funds WHERE id = $1 AND is_active = true', [fundId]);
    if (fundResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Fund not found or inactive' });
      return;
    }

    const fund = fundResult.rows[0];
    if (amount < parseFloat(fund.minimum_investment)) {
      res.status(400).json({
        success: false,
        error: `Minimum investment for ${fund.name} is KES ${parseFloat(fund.minimum_investment).toLocaleString()}`,
      });
      return;
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);

    // Initiate STK Push for investment
    const stkResponse = await initiateSTKPush({
      phone: normalizedPhone,
      amount,
      accountReference: `INV-${fund.name.substring(0, 10)}`,
      description: `Investment in ${fund.name}`,
    });

    // Record transaction
    const txResult = await query(
      `INSERT INTO transactions (user_id, type, amount, phone, merchant_request_id, checkout_request_id, status, description)
       VALUES ($1, 'stk_push', $2, $3, $4, $5, 'pending', $6)
       RETURNING id`,
      [req.userId, amount, normalizedPhone, stkResponse.MerchantRequestID, stkResponse.CheckoutRequestID, `Investment in ${fund.name}`]
    );

    // Create pending investment
    const maturesAt = fund.maturity_days > 0
      ? new Date(Date.now() + fund.maturity_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const investResult = await query(
      `INSERT INTO investments (user_id, fund_id, amount, current_value, status, matures_at, transaction_id)
       VALUES ($1, $2, $3, $3, 'pending', $4, $5)
       RETURNING id`,
      [req.userId, fundId, amount, maturesAt, txResult.rows[0].id]
    );

    res.json({
      success: true,
      data: {
        investmentId: investResult.rows[0].id,
        transactionId: txResult.rows[0].id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage,
        fund: {
          name: fund.name,
          interestRate: parseFloat(fund.interest_rate),
        },
      },
    });
  } catch (error) {
    console.error('Investment error:', error);
    res.status(500).json({ success: false, error: 'Investment failed' });
  }
};

export const getUserInvestments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT i.*, f.name as fund_name, f.provider, f.interest_rate, f.risk_level
       FROM investments i
       JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      data: result.rows.map((i: Record<string, unknown>) => ({
        id: i.id,
        fundId: i.fund_id,
        fundName: i.fund_name,
        provider: i.provider,
        amount: parseFloat(i.amount as string),
        accruedInterest: parseFloat(i.accrued_interest as string),
        currentValue: parseFloat(i.current_value as string),
        interestRate: parseFloat(i.interest_rate as string),
        riskLevel: i.risk_level,
        status: i.status,
        investedAt: i.invested_at,
        maturesAt: i.matures_at,
      })),
    });
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch investments' });
  }
};
