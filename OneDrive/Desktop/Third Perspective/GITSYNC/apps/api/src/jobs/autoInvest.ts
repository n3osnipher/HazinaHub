import cron from 'node-cron';
import { query } from '../config/database';
import { initiateSTKPush } from '../services/mpesa.service';

/**
 * Auto-invest job - runs daily at 01:00 EAT
 * Automatically invests a percentage of profits for opted-in users
 */
export function startAutoInvestJob(): void {
  cron.schedule('0 22 * * *', async () => {
    console.log('🤖 Running auto-invest...');

    try {
      // Find users with auto-invest enabled
      const users = await query(
        `SELECT u.id, u.phone, u.auto_invest_percentage, u.auto_invest_fund_id, f.name as fund_name
         FROM users u
         LEFT JOIN mmf_funds f ON u.auto_invest_fund_id = f.id
         WHERE u.auto_invest_enabled = true AND u.auto_invest_percentage > 0 AND u.auto_invest_fund_id IS NOT NULL`
      );

      for (const user of users.rows) {
        // Calculate today's profit
        const profitResult = await query(
          `SELECT COALESCE(SUM(amount), 0) as today_profit
           FROM transactions
           WHERE user_id = $1 AND type IN ('c2b', 'stk_push') AND status = 'completed'
             AND created_at >= CURRENT_DATE`,
          [user.id]
        );

        const todayProfit = parseFloat(profitResult.rows[0].today_profit);
        if (todayProfit <= 0) continue;

        const investAmount = Math.floor(todayProfit * (parseFloat(user.auto_invest_percentage) / 100));
        if (investAmount < 1000) continue; // Minimum investment threshold

        try {
          // Initiate STK Push for auto-investment
          const stkResponse = await initiateSTKPush({
            phone: user.phone,
            amount: investAmount,
            accountReference: `AUTO-${user.fund_name?.substring(0, 8) || 'INV'}`,
            description: `Auto-invest: ${user.auto_invest_percentage}% of daily profit`,
          });

          // Record transaction
          const txResult = await query(
            `INSERT INTO transactions (user_id, type, amount, phone, merchant_request_id, checkout_request_id, status, description)
             VALUES ($1, 'stk_push', $2, $3, $4, $5, 'pending', $6)
             RETURNING id`,
            [user.id, investAmount, user.phone, stkResponse.MerchantRequestID, stkResponse.CheckoutRequestID,
             `Auto-invest in ${user.fund_name}`]
          );

          // Create pending investment
          await query(
            `INSERT INTO investments (user_id, fund_id, amount, current_value, status, transaction_id)
             VALUES ($1, $2, $3, $3, 'pending', $4)`,
            [user.id, user.auto_invest_fund_id, investAmount, txResult.rows[0].id]
          );

          console.log(`  💰 Auto-invested KES ${investAmount} for user ${user.id}`);
        } catch (err) {
          console.error(`  ❌ Auto-invest failed for user ${user.id}:`, err);
        }
      }

      console.log(`✅ Auto-invest completed for ${users.rows.length} users`);
    } catch (error) {
      console.error('❌ Auto-invest job error:', error);
    }
  });

  console.log('⏰ Auto-invest job scheduled (daily at 01:00 EAT)');
}
