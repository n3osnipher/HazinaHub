import cron from 'node-cron';
import { MmfFund } from '../models/MmfFund';

/**
 * Scheduled job to update MMF rates (every 6 hours)
 * In production, this would fetch from a data provider API
 */
export function startMMFRateUpdater(): void {
  cron.schedule('0 */6 * * *', async () => {
    console.log('📈 Updating MMF rates...');

    try {
      // Simulate slight rate fluctuations using MongoDB
      const funds = await MmfFund.find({ isActive: true });

      for (const fund of funds) {
        const currentRate = fund.interestRate;
        // Random fluctuation of ±0.1%
        const fluctuation = (Math.random() - 0.5) * 0.2;
        const newRate = Math.max(5, Math.min(25, currentRate + fluctuation));

        fund.interestRate = parseFloat(newRate.toFixed(3));
        await fund.save();
      }

      console.log(`✅ Updated rates for ${funds.length} MMFs in MongoDB`);
    } catch (error) {
      console.error('❌ MMF rate update error:', error);
    }
  });

  console.log('⏰ MMF rate updater scheduled (every 6 hours)');
}
