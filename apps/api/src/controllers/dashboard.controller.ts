import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { checkAccountBalance } from '../services/mpesa.service';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';

export const getDashboardSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Trigger Daraja generic balance check (async)
    try {
      checkAccountBalance().catch((e: Error) => console.error('Daraja Balance Check Failed:', e.message));
    } catch (e) { }

    // 1. Account balance from Mongoose User
    const user = await User.findById(userId);
    const accountBalance = user ? user.walletBalance : 0;

    // 2. Total sales (completed incoming c2b/stk_push in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const salesAgg = await Transaction.aggregate([
      { 
        $match: { 
          userId: user?._id, 
          type: { $in: ['c2b', 'stk_push', 'deposit'] }, 
          status: 'completed',
          createdAt: { $gte: oneDayAgo }
        } 
      },
      { $group: { _id: null, totalSales: { $sum: "$amount" } } }
    ]);
    const totalSales = salesAgg.length > 0 ? salesAgg[0].totalSales : 0;

    // 3. Monthly profits (MMF Returns from mock DB investments)
    const profitsResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) AND type IN ('c2b', 'stk_push') THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) AND type IN ('b2c', 'withdrawal') THEN amount ELSE 0 END), 0) as this_month,
        
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - interval '1 month') 
          AND created_at < date_trunc('month', CURRENT_DATE) AND type IN ('c2b', 'stk_push') THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - interval '1 month') 
          AND created_at < date_trunc('month', CURRENT_DATE) AND type IN ('b2c', 'withdrawal') THEN amount ELSE 0 END), 0) as last_month
       FROM transactions WHERE user_id = $1 AND status = 'completed'`,
      ['legacy_query_ignored_by_mock']
    );
    const thisMonth = parseFloat(profitsResult.rows[0]?.this_month || '0');
    const lastMonth = parseFloat(profitsResult.rows[0]?.last_month || '0');
    const profitGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    // 4. Weekly transaction graph (last 7 days from Mongoose)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyTx = await Transaction.find({
      userId: user?._id,
      status: 'completed',
      createdAt: { $gte: sevenDaysAgo }
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap: Record<string, number> = {};
    for (const tx of weeklyTx) {
      const dayName = dayNames[tx.createdAt.getDay()];
      weeklyMap[dayName] = (weeklyMap[dayName] || 0) + tx.amount;
    }

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = daysOfWeek.map(day => ({
      day,
      amount: weeklyMap[day] || 0
    }));

    // 5. Recent transactions (last 5 from Mongoose)
    const recentTx = await Transaction.find({ userId: user?._id })
      .sort({ createdAt: -1 })
      .limit(5);

    // 6. AI Insight (latest from mock DB)
    const insightResult = await query(
      `SELECT content FROM ai_insights WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      ['legacy_query_ignored_by_mock']
    );

    res.json({
      success: true,
      data: {
        accountBalance,
        totalSales,
        monthlyProfits: thisMonth,
        profitGrowth: Math.round(profitGrowth * 10) / 10,
        weeklyTransactions: weeklyData,
        recentTransactions: recentTx.map(t => ({
          id: t._id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.description,
          mpesaReceiptNumber: t.mpesa_receipt_number,
          createdAt: t.createdAt,
        })),
        aiInsight: insightResult.rows[0]?.content || 'Welcome to HazinaHub! Start transacting to receive AI-powered financial insights.',
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
};
