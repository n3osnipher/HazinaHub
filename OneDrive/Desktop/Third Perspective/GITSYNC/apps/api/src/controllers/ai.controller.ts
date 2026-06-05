import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { analyzeFinancials, getInvestmentAdvice, calculateHealthScore, predictRevenueTrend } from '../services/ai.service';

export const analyzeTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Get transaction data
    const txResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type IN ('c2b', 'stk_push') AND status = 'completed' THEN amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN type IN ('b2c', 'withdrawal') AND status = 'completed' THEN amount ELSE 0 END), 0) as expenses,
        COUNT(*) as count
       FROM transactions WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    const recentTx = await query(
      `SELECT amount, type, created_at FROM transactions WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    // Get investment data
    const invResult = await query(
      `SELECT i.amount, i.current_value, i.accrued_interest, f.name, f.interest_rate
       FROM investments i JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1 AND i.status = 'active'`,
      [userId]
    );

    // Get business name
    const userResult = await query('SELECT business_name FROM users WHERE id = $1', [userId]);
    const businessName = userResult.rows[0]?.business_name || 'My Business';

    const totalRevenue = parseFloat(txResult.rows[0].revenue);
    const totalExpenses = parseFloat(txResult.rows[0].expenses);
    const transactionCount = parseInt(txResult.rows[0].count);

    const analysis = await analyzeFinancials(
      {
        totalRevenue,
        totalExpenses,
        transactionCount,
        averageTransaction: transactionCount > 0 ? (totalRevenue + totalExpenses) / transactionCount : 0,
        recentTransactions: recentTx.rows.map((t: Record<string, unknown>) => ({
          amount: parseFloat(t.amount as string),
          type: t.type as string,
          date: (t.created_at as Date).toISOString(),
        })),
      },
      {
        totalInvested: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.amount as string), 0),
        currentValue: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.current_value as string), 0),
        returns: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.accrued_interest as string), 0),
        funds: invResult.rows.map((i: Record<string, unknown>) => ({
          name: i.name as string,
          amount: parseFloat(i.amount as string),
          rate: parseFloat(i.interest_rate as string),
        })),
      },
      businessName
    );

    // Cache the insight
    await query(
      `INSERT INTO ai_insights (user_id, type, content, confidence) VALUES ($1, 'investment_advice', $2, 0.85)`,
      [userId, analysis]
    );

    res.json({ success: true, data: { analysis } });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
};

export const getAdvice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { riskTolerance = 'medium', monthlyIncome = 50000 } = req.body;

    // Get existing investments
    const invResult = await query(
      `SELECT i.amount, i.current_value, i.accrued_interest, f.name, f.interest_rate
       FROM investments i JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1 AND i.status = 'active'`,
      [userId]
    );

    // Get available funds
    const fundsResult = await query('SELECT * FROM mmf_funds WHERE is_active = true ORDER BY interest_rate DESC');

    const advice = await getInvestmentAdvice(
      riskTolerance,
      monthlyIncome,
      {
        totalInvested: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.amount as string), 0),
        currentValue: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.current_value as string), 0),
        returns: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.accrued_interest as string), 0),
        funds: invResult.rows.map((i: Record<string, unknown>) => ({
          name: i.name as string,
          amount: parseFloat(i.amount as string),
          rate: parseFloat(i.interest_rate as string),
        })),
      },
      fundsResult.rows.map((f: Record<string, unknown>) => ({
        name: f.name as string,
        rate: parseFloat(f.interest_rate as string),
        riskLevel: f.risk_level as string,
        minInvestment: parseFloat(f.minimum_investment as string),
      }))
    );

    res.json({ success: true, data: { advice } });
  } catch (error) {
    console.error('AI advice error:', error);
    res.status(500).json({ success: false, error: 'Failed to get advice' });
  }
};

export const getHealthScore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const txResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type IN ('c2b', 'stk_push') AND status = 'completed' THEN amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN type IN ('b2c', 'withdrawal') AND status = 'completed' THEN amount ELSE 0 END), 0) as expenses,
        COUNT(*) as count
       FROM transactions WHERE user_id = $1`,
      [userId]
    );

    const invResult = await query(
      `SELECT i.amount, i.current_value, i.accrued_interest, f.name, f.interest_rate
       FROM investments i JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1 AND i.status = 'active'`,
      [userId]
    );

    const score = await calculateHealthScore(
      {
        totalRevenue: parseFloat(txResult.rows[0].revenue),
        totalExpenses: parseFloat(txResult.rows[0].expenses),
        transactionCount: parseInt(txResult.rows[0].count),
        averageTransaction: 0,
        recentTransactions: [],
      },
      {
        totalInvested: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.amount as string), 0),
        currentValue: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.current_value as string), 0),
        returns: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.accrued_interest as string), 0),
        funds: invResult.rows.map((i: Record<string, unknown>) => ({
          name: i.name as string,
          amount: parseFloat(i.amount as string),
          rate: parseFloat(i.interest_rate as string),
        })),
      }
    );

    res.json({ success: true, data: score });
  } catch (error) {
    console.error('Health score error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate health score' });
  }
};

export const getInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT * FROM ai_insights WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.userId]
    );

    res.json({
      success: true,
      data: result.rows.map((i: Record<string, unknown>) => ({
        id: i.id,
        type: i.type,
        content: i.content,
        riskScore: i.risk_score ? parseFloat(i.risk_score as string) : null,
        confidence: parseFloat(i.confidence as string),
        createdAt: i.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
};

export const processChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    // Get basic transaction data
    const txResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type IN ('c2b', 'stk_push') AND status = 'completed' THEN amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN type IN ('b2c', 'withdrawal') AND status = 'completed' THEN amount ELSE 0 END), 0) as expenses,
        COUNT(*) as count
       FROM transactions WHERE user_id = $1`,
      [userId]
    );

    // Get existing investments
    const invResult = await query(
      `SELECT i.amount, i.current_value, i.accrued_interest, f.name, f.interest_rate
       FROM investments i JOIN mmf_funds f ON i.fund_id = f.id
       WHERE i.user_id = $1 AND i.status = 'active'`,
      [userId]
    );

    // Get business name
    const userResult = await query('SELECT business_name FROM users WHERE id = $1', [userId]);
    const businessName = userResult.rows[0]?.business_name || 'My Business';

    const { processChatMessage } = await import('../services/ai.service');

    const reply = await processChatMessage(
      message,
      {
        totalRevenue: parseFloat(txResult.rows[0].revenue),
        totalExpenses: parseFloat(txResult.rows[0].expenses),
        transactionCount: parseInt(txResult.rows[0].count),
        averageTransaction: 0, // Simplified for chat
        recentTransactions: [], // Simplified for chat
      },
      {
        totalInvested: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.amount as string), 0),
        currentValue: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.current_value as string), 0),
        returns: invResult.rows.reduce((sum: number, i: Record<string, unknown>) => sum + parseFloat(i.accrued_interest as string), 0),
        funds: invResult.rows.map((i: Record<string, unknown>) => ({
          name: i.name as string,
          amount: parseFloat(i.amount as string),
          rate: parseFloat(i.interest_rate as string),
        })),
      },
      businessName
    );

    res.json({ success: true, data: { reply } });
  } catch (error: any) {
    console.error('AI chat error:', error);
    
    // If rate-limited or Gemini unavailable, return a helpful fallback instead of 500
    const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      res.json({
        success: true,
        data: {
          reply: "I'm currently experiencing high demand and need a brief moment to recharge. Please try again in about a minute — I'll be ready to help with your financial analysis! 💡\n\nIn the meantime, you can check your Dashboard for real-time transaction data and AI insights."
        }
      });
      return;
    }
    
    res.status(500).json({ success: false, error: 'Chat processing failed' });
  }
};
