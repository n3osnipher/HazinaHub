import cron from 'node-cron';
import { query } from '../config/database';

/**
 * Daily interest accrual job - runs at midnight EAT (UTC+3)
 * Calculates and adds daily interest to all active investments
 */
export function startInterestAccrualJob(): void {
  // Run at 00:05 EAT daily
  cron.schedule('5 21 * * *', async () => {
    console.log('📊 Running daily interest accrual...');

    try {
      // Get all active investments with their fund rates
      const result = await query(
        `SELECT i.id, i.amount, i.accrued_interest, i.current_value, f.interest_rate, f.maturity_days, i.invested_at
         FROM investments i
         JOIN mmf_funds f ON i.fund_id = f.id
         WHERE i.status = 'active'`
      );

      let totalAccrued = 0;
      for (const inv of result.rows) {
        const dailyRate = parseFloat(inv.interest_rate) / 100 / 365;
        const currentValue = parseFloat(inv.current_value) || parseFloat(inv.amount);
        const dailyInterest = currentValue * dailyRate;

        const newAccruedInterest = parseFloat(inv.accrued_interest) + dailyInterest;
        const newCurrentValue = parseFloat(inv.amount) + newAccruedInterest;

        await query(
          `UPDATE investments 
           SET accrued_interest = $1, current_value = $2, updated_at = NOW()
           WHERE id = $3`,
          [newAccruedInterest.toFixed(4), newCurrentValue.toFixed(4), inv.id]
        );

        totalAccrued += dailyInterest;

        // Check maturity
        if (inv.maturity_days > 0) {
          const investedDate = new Date(inv.invested_at);
          const maturityDate = new Date(investedDate.getTime() + inv.maturity_days * 86400000);
          if (new Date() >= maturityDate) {
            await query(`UPDATE investments SET status = 'matured', updated_at = NOW() WHERE id = $1`, [inv.id]);
          }
        }
      }

      // Take portfolio snapshots for each user
      const users = await query(
        `SELECT DISTINCT user_id FROM investments WHERE status IN ('active', 'matured')`
      );

      for (const user of users.rows) {
        const portfolio = await query(
          `SELECT COALESCE(SUM(amount), 0) as invested, COALESCE(SUM(current_value), 0) as value, COALESCE(SUM(accrued_interest), 0) as returns
           FROM investments WHERE user_id = $1 AND status IN ('active', 'matured')`,
          [user.user_id]
        );

        await query(
          `INSERT INTO portfolio_snapshots (user_id, total_invested, current_value, total_returns, snapshot_date)
           VALUES ($1, $2, $3, $4, CURRENT_DATE)
           ON CONFLICT (user_id, snapshot_date) DO UPDATE SET current_value = $3, total_returns = $4`,
          [user.user_id, portfolio.rows[0].invested, portfolio.rows[0].value, portfolio.rows[0].returns]
        );
      }

      console.log(`✅ Interest accrued: KES ${totalAccrued.toFixed(2)} across ${result.rows.length} investments`);
    } catch (error) {
      console.error('❌ Interest accrual error:', error);
    }
  });

  console.log('⏰ Interest accrual job scheduled (daily at 00:05 EAT)');
}
