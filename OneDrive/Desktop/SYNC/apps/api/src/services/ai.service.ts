import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Retry wrapper for Gemini API calls — handles 429 rate-limit errors
 * with exponential backoff (2s, 4s, 8s)
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.response?.status || error?.code;
      const isRateLimit = status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Gemini rate-limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

interface TransactionData {
  totalRevenue: number;
  totalExpenses: number;
  transactionCount: number;
  averageTransaction: number;
  recentTransactions: Array<{ amount: number; type: string; date: string }>;
}

interface InvestmentData {
  totalInvested: number;
  currentValue: number;
  returns: number;
  funds: Array<{ name: string; amount: number; rate: number }>;
}

/**
 * Generate financial analysis using Gemini
 */
export async function analyzeFinancials(
  transactions: TransactionData,
  investments: InvestmentData,
  businessName: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

  const prompt = `You are Hazina AI, a financial advisor for Kenyan small businesses. 
Analyze the following financial data for "${businessName}" and provide actionable insights in 3-4 bullet points.
Focus on cash flow patterns, spending optimization, and growth opportunities.
Use KES (Kenyan Shilling) for all amounts. Keep it concise and professional.

Transaction Summary:
- Total Revenue: KES ${transactions.totalRevenue.toLocaleString()}
- Total Expenses: KES ${transactions.totalExpenses.toLocaleString()}
- Transaction Count: ${transactions.transactionCount}
- Average Transaction: KES ${transactions.averageTransaction.toLocaleString()}

Investment Summary:
- Total Invested: KES ${investments.totalInvested.toLocaleString()}
- Current Value: KES ${investments.currentValue.toLocaleString()}
- Returns: KES ${investments.returns.toLocaleString()}
- Active Funds: ${investments.funds.map(f => `${f.name} (${f.rate}%)`).join(', ')}

Provide your analysis:`;

  const result = await callWithRetry(() => model.generateContent(prompt));
  return result.response.text();
}

/**
 * Get investment advice based on risk profile and financial data
 */
export async function getInvestmentAdvice(
  riskTolerance: 'low' | 'medium' | 'high',
  monthlyIncome: number,
  existingInvestments: InvestmentData,
  availableFunds: Array<{ name: string; rate: number; riskLevel: string; minInvestment: number }>
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

  const prompt = `You are Hazina AI, an investment advisor for Kenyan small businesses.
Based on the following profile, recommend the best Money Market Fund allocation.

Risk Tolerance: ${riskTolerance}
Monthly Income: KES ${monthlyIncome.toLocaleString()}
Current Investments: KES ${existingInvestments.totalInvested.toLocaleString()} across ${existingInvestments.funds.length} funds

Available MMFs in Kenya:
${availableFunds.map(f => `- ${f.name}: ${f.rate}% p.a., Min KES ${f.minInvestment.toLocaleString()}, Risk: ${f.riskLevel}`).join('\n')}

Provide specific fund recommendations with allocation percentages. Keep it to 3-4 actionable points.`;

  const result = await callWithRetry(() => model.generateContent(prompt));
  return result.response.text();
}

/**
 * Calculate financial health score
 */
export async function calculateHealthScore(
  transactions: TransactionData,
  investments: InvestmentData
): Promise<{
  overall: number;
  cashFlow: number;
  savings: number;
  investmentDiversity: number;
  recommendations: string[];
}> {
  // Algorithmic scoring (no AI needed for deterministic metrics)
  const savingsRate = transactions.totalRevenue > 0
    ? ((transactions.totalRevenue - transactions.totalExpenses) / transactions.totalRevenue) * 100
    : 0;

  const cashFlowScore = Math.min(100, Math.max(0,
    savingsRate > 20 ? 90 : savingsRate > 10 ? 70 : savingsRate > 0 ? 50 : 20
  ));

  const savingsScore = Math.min(100, Math.max(0,
    investments.totalInvested > 0 ? Math.min(90, (investments.totalInvested / transactions.totalRevenue) * 100) : 10
  ));

  const diversityScore = Math.min(100,
    investments.funds.length >= 4 ? 90 : investments.funds.length >= 2 ? 70 : investments.funds.length === 1 ? 50 : 10
  );

  const investmentReturnScore = investments.returns > 0 ? Math.min(100, 60 + (investments.returns / investments.totalInvested) * 200) : 30;

  const overall = Math.round((cashFlowScore * 0.3 + savingsScore * 0.25 + diversityScore * 0.20 + investmentReturnScore * 0.25));

  const recommendations: string[] = [];
  if (savingsRate < 10) recommendations.push('Increase your savings rate to at least 10% of revenue');
  if (investments.funds.length < 2) recommendations.push('Diversify by investing in at least 2 different MMFs');
  if (investments.totalInvested === 0) recommendations.push('Start investing — even KES 1,000 in a money market fund');
  if (cashFlowScore < 50) recommendations.push('Review expenses to improve cash flow stability');

  return {
    overall,
    cashFlow: Math.round(cashFlowScore),
    savings: Math.round(savingsScore),
    investmentDiversity: Math.round(diversityScore),
    recommendations,
  };
}

/**
 * Predict revenue trend
 */
export async function predictRevenueTrend(
  monthlyRevenues: number[],
  businessName: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

  const prompt = `You are Hazina AI. Analyze these monthly revenue figures (KES) for "${businessName}" and predict the next 3 months trend. 
Be specific with predicted amounts and reasoning. Keep it to 3-4 concise points.

Monthly Revenues (oldest to newest): ${monthlyRevenues.map(r => `KES ${r.toLocaleString()}`).join(', ')}`;

  const result = await callWithRetry(() => model.generateContent(prompt));
  return result.response.text();
}

/**
 * Process a conversational chat message
 */
export async function processChatMessage(
  message: string,
  transactions: TransactionData,
  investments: InvestmentData,
  businessName: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

    const systemPrompt = `You are Hazina AI, a friendly, intelligent financial advisor for Kenyan small businesses. 
You are currently talking to the owner of "${businessName}".
Keep your answers conversational, concise, and highly relevant.
Whenever you talk about money, use KES (Kenyan Shilling) and format numbers clearly (e.g., KES 10,000).

Here is the current financial context of the business:
- Total Revenue (Incoming): KES ${transactions.totalRevenue.toLocaleString()}
- Total Expenses (Outgoing): KES ${transactions.totalExpenses.toLocaleString()}
- Total Invested in MMFs: KES ${investments.totalInvested.toLocaleString()}
- Current Investment Value: KES ${investments.currentValue.toLocaleString()}
- Active Funds: ${investments.funds.length > 0 ? investments.funds.map(f => f.name).join(', ') : 'None'}

User Message: "${message}"

Respond directly to the user's message as Hazina AI:`;

    const result = await callWithRetry(() => model.generateContent(systemPrompt));
    return result.response.text();
  } catch {
    // Offline fallback — generate helpful response without Gemini
    return generateOfflineResponse(message, transactions, investments, businessName);
  }
}

/**
 * Generate a helpful response locally when Gemini API is unavailable
 */
function generateOfflineResponse(
  message: string,
  transactions: TransactionData,
  investments: InvestmentData,
  businessName: string
): string {
  const msg = message.toLowerCase();
  const balance = transactions.totalRevenue - transactions.totalExpenses;

  if (msg.includes('balance') || msg.includes('account')) {
    return `Hi ${businessName}! Your current account balance is KES ${balance.toLocaleString()}. You've received KES ${transactions.totalRevenue.toLocaleString()} in deposits and spent KES ${transactions.totalExpenses.toLocaleString()}.`;
  }

  if (msg.includes('invest') || msg.includes('mmf') || msg.includes('fund') || msg.includes('money market')) {
    if (investments.totalInvested > 0) {
      return `You currently have KES ${investments.totalInvested.toLocaleString()} invested across ${investments.funds.length} fund(s) — ${investments.funds.map(f => f.name).join(', ')}. Your total returns so far are KES ${investments.returns.toLocaleString()}. Consider diversifying across 2–3 funds for better risk management!`;
    }
    return `You haven't invested in any Money Market Funds yet. I'd recommend starting with as little as KES 1,000 in a low-risk fund like the CIC Money Market Fund (14.5% p.a.) or the Cytonn MMF (16.1% p.a.). Head to the Investments tab to explore options!`;
  }

  if (msg.includes('save') || msg.includes('saving') || msg.includes('budget')) {
    const savingsRate = transactions.totalRevenue > 0 ? ((balance / transactions.totalRevenue) * 100).toFixed(1) : '0';
    return `Your current savings rate is ${savingsRate}% of your total income. Financial experts recommend saving at least 20% of your revenue. Consider setting up automatic deposits and investing idle cash in a Money Market Fund to earn returns while saving.`;
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('help')) {
    return `Hello! 👋 I'm Hazina AI, your financial advisor. I can help you with:\n\n• **Account balance** — Check your current funds\n• **Investment advice** — Explore Money Market Funds\n• **Savings tips** — Optimize your finances\n• **Financial health** — Review your spending patterns\n\nWhat would you like to know about?`;
  }

  // Default helpful response
  return `Thanks for your question! Here's a quick overview of your finances, ${businessName}:\n\n• Balance: KES ${balance.toLocaleString()}\n• Total Deposits: KES ${transactions.totalRevenue.toLocaleString()}\n• Invested: KES ${investments.totalInvested.toLocaleString()}\n• MMF Returns: KES ${investments.returns.toLocaleString()}\n\nTip: Deposit funds via the Dashboard, then visit the Investments tab to grow your money with Kenya's top Money Market Funds!`;
}
