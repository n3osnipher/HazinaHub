import cron from 'node-cron';
import { query } from '../config/database';
import { notifyFraudAlert } from '../services/sms.service';

/**
 * Fraud detection job - runs every 30 minutes
 * Checks for suspicious transaction patterns
 */
export function startFraudDetectionJob(): void {
  cron.schedule('*/30 * * * *', async () => {
    try {
      // Pattern 1: Multiple failed transactions in short period
      const failedPattern = await query(
        `SELECT user_id, COUNT(*) as failed_count, MAX(phone) as phone
         FROM transactions
         WHERE status = 'failed' AND created_at >= NOW() - interval '1 hour'
         GROUP BY user_id
         HAVING COUNT(*) >= 5`
      );

      for (const alert of failedPattern.rows) {
        const existing = await query(
          `SELECT id FROM fraud_alerts 
           WHERE user_id = $1 AND alert_type = 'multiple_failures' AND created_at >= NOW() - interval '2 hours'`,
          [alert.user_id]
        );

        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO fraud_alerts (user_id, alert_type, severity, description)
             VALUES ($1, 'multiple_failures', 'high', $2)`,
            [alert.user_id, `${alert.failed_count} failed transactions in the last hour`]
          );

          // Get user phone
          const userResult = await query('SELECT phone FROM users WHERE id = $1', [alert.user_id]);
          if (userResult.rows[0]) {
            notifyFraudAlert(userResult.rows[0].phone, 'Multiple failed transactions detected on your account').catch(console.error);
          }
        }
      }

      // Pattern 2: Unusually large transaction
      const largePattern = await query(
        `SELECT t.user_id, t.id as transaction_id, t.amount, u.phone
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.created_at >= NOW() - interval '30 minutes'
           AND t.amount > (
             SELECT COALESCE(AVG(amount) * 5, 100000)
             FROM transactions
             WHERE user_id = t.user_id AND status = 'completed'
           )`
      );

      for (const alert of largePattern.rows) {
        const existing = await query(
          `SELECT id FROM fraud_alerts WHERE transaction_id = $1`,
          [alert.transaction_id]
        );

        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO fraud_alerts (user_id, transaction_id, alert_type, severity, description)
             VALUES ($1, $2, 'large_transaction', 'medium', $3)`,
            [alert.user_id, alert.transaction_id, `Unusually large transaction of KES ${parseFloat(alert.amount).toLocaleString()}`]
          );
        }
      }

      // Pattern 3: Rapid successive transactions
      const rapidPattern = await query(
        `SELECT user_id, COUNT(*) as tx_count, MAX(phone) as phone
         FROM transactions
         WHERE created_at >= NOW() - interval '5 minutes'
         GROUP BY user_id
         HAVING COUNT(*) >= 10`
      );

      for (const alert of rapidPattern.rows) {
        const existing = await query(
          `SELECT id FROM fraud_alerts
           WHERE user_id = $1 AND alert_type = 'rapid_transactions' AND created_at >= NOW() - interval '30 minutes'`,
          [alert.user_id]
        );

        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO fraud_alerts (user_id, alert_type, severity, description)
             VALUES ($1, 'rapid_transactions', 'critical', $2)`,
            [alert.user_id, `${alert.tx_count} transactions in 5 minutes — possible automated attack`]
          );

          const userResult = await query('SELECT phone FROM users WHERE id = $1', [alert.user_id]);
          if (userResult.rows[0]) {
            notifyFraudAlert(userResult.rows[0].phone, 'Unusual rapid transactions detected').catch(console.error);
          }
        }
      }
    } catch (error) {
      console.error('Fraud detection error:', error);
    }
  });

  console.log('🛡️ Fraud detection job scheduled (every 30 minutes)');
}
