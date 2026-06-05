/**
 * In-memory mock database for development without PostgreSQL
 * Simulates the pg.Pool query interface with mock data
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface MockRow {
  [key: string]: unknown;
}

// ─── In-Memory Tables ──────────────────────────────────────
const users: MockRow[] = [];
const transactions: MockRow[] = [];
const investments: MockRow[] = [];
const mmfFunds: MockRow[] = [
  { id: uuidv4(), name: 'CIC Money Market Fund', provider: 'CIC Asset Management', interest_rate: '14.500', minimum_investment: '1000.00', risk_level: 'low', maturity_days: 0, total_aum: '52000000000.00', is_active: true, description: 'A low-risk fund investing in short-term money market instruments with daily liquidity.', website_url: 'https://cic.co.ke/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'ICEA Lion Money Market Fund', provider: 'ICEA Lion Asset Management', interest_rate: '13.800', minimum_investment: '5000.00', risk_level: 'low', maturity_days: 0, total_aum: '38000000000.00', is_active: true, description: 'Invests in high-quality short-term securities with competitive returns.', website_url: 'https://icealion.com/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'Sanlam Money Market Fund', provider: 'Sanlam Investments', interest_rate: '14.200', minimum_investment: '2500.00', risk_level: 'low', maturity_days: 0, total_aum: '25000000000.00', is_active: true, description: 'Focuses on capital preservation with attractive yields from government securities.', website_url: 'https://www.sanlam.co.ke/investments/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'Cytonn Money Market Fund', provider: 'Cytonn Investments', interest_rate: '16.100', minimum_investment: '1000.00', risk_level: 'medium', maturity_days: 0, total_aum: '18000000000.00', is_active: true, description: 'Higher yield fund with exposure to corporate commercial paper and fixed deposits.', website_url: 'https://cytonn.com/topup/money-market-fund', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'Nabo Africa Money Market Fund', provider: 'Nabo Capital', interest_rate: '13.500', minimum_investment: '10000.00', risk_level: 'low', maturity_days: 0, total_aum: '12000000000.00', is_active: true, description: 'Conservative fund targeting institutional and retail investors.', website_url: 'https://nabocapital.com/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'Zimele Money Market Fund', provider: 'Zimele Asset Management', interest_rate: '15.000', minimum_investment: '1000.00', risk_level: 'medium', maturity_days: 0, total_aum: '8000000000.00', is_active: true, description: 'Balanced approach between government and corporate securities.', website_url: 'https://zimele.net/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'GenAfrica Money Market Fund', provider: 'GenAfrica Asset Managers', interest_rate: '14.800', minimum_investment: '5000.00', risk_level: 'low', maturity_days: 0, total_aum: '15000000000.00', is_active: true, description: 'Premium fund with strong track record in the Kenyan market.', website_url: 'https://www.genafrica.com/money-market-fund/', created_at: new Date(), updated_at: new Date() },
  { id: uuidv4(), name: 'Old Mutual Money Market Fund', provider: 'Old Mutual Investment Group', interest_rate: '13.200', minimum_investment: '5000.00', risk_level: 'low', maturity_days: 0, total_aum: '45000000000.00', is_active: true, description: "East Africa's largest money market fund with unmatched liquidity.", website_url: 'https://www.oldmutual.co.ke/personal/investments-and-savings/unit-trusts/old-mutual-money-market-fund/', created_at: new Date(), updated_at: new Date() },
];
const portfolioSnapshots: MockRow[] = [];
const aiInsights: MockRow[] = [];
const auditLogs: MockRow[] = [];
const notifications: MockRow[] = [];
const fraudAlerts: MockRow[] = [];

// ─── Table Map ─────────────────────────────────────────────
const tables: Record<string, MockRow[]> = {
  users, transactions, investments, mmf_funds: mmfFunds,
  portfolio_snapshots: portfolioSnapshots, ai_insights: aiInsights,
  audit_logs: auditLogs, notifications, fraud_alerts: fraudAlerts,
};

// ─── SQL Parser (basic) ────────────────────────────────────
function detectTable(sql: string): string {
  const match = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+(\w+)/i);
  return match ? match[1].toLowerCase() : 'users';
}

/**
 * Mock query function that simulates PostgreSQL responses
 */
export async function mockQuery(text: string, params?: unknown[]): Promise<{ rows: MockRow[]; rowCount: number }> {
  const sql = text.trim().toUpperCase();
  const tableName = detectTable(text);
  const table = tables[tableName] || [];

  // ─── INSERT ────────────────────────────────────────────
  if (sql.startsWith('INSERT')) {
    const newRow: MockRow = { id: uuidv4(), created_at: new Date(), updated_at: new Date() };

    // Parse column names from INSERT statement
    const colMatch = text.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch && params) {
      const cols = colMatch[1].split(',').map(c => c.trim());
      cols.forEach((col, i) => {
        if (params[i] !== undefined) newRow[col] = params[i];
      });
    }

    // Auto-generate fields for users
    if (tableName === 'users') {
      newRow.role = newRow.role || 'user';
      newRow.is_verified = false;
      newRow.is_active = true;
      newRow.login_attempts = 0;
      newRow.auto_invest_enabled = false;
      newRow.auto_invest_percentage = '0.00';
    }

    // For investments
    if (tableName === 'investments') {
      newRow.accrued_interest = newRow.accrued_interest || '0.0000';
      newRow.current_value = newRow.current_value || newRow.amount;
    }

    table.push(newRow);

    // Check for RETURNING clause
    if (text.includes('RETURNING')) {
      const retMatch = text.match(/RETURNING\s+(.+)/i);
      if (retMatch) {
        const retCols = retMatch[1].split(',').map(c => c.trim());
        const retRow: MockRow = {};
        retCols.forEach(col => {
          retRow[col] = newRow[col];
        });
        return { rows: [retRow.id ? retRow : newRow], rowCount: 1 };
      }
    }
    return { rows: [newRow], rowCount: 1 };
  }

  // ─── SELECT ────────────────────────────────────────────
  if (sql.startsWith('SELECT')) {
    // Handle specific queries
    if (text.includes('FROM users WHERE email')) {
      const email = params?.[0];
      const found = users.filter(u => u.email === email);
      return { rows: found, rowCount: found.length };
    }

    if (text.includes('FROM users WHERE id')) {
      const id = params?.[0];
      const found = users.filter(u => u.id === id);
      return { rows: found, rowCount: found.length };
    }

    if (text.includes('FROM users WHERE phone')) {
      const phone = params?.[0];
      const found = users.filter(u => u.phone === phone);
      return { rows: found, rowCount: found.length };
    }

    // Dashboard: balance (only reflects actual deposits)
    if (text.includes('COALESCE(SUM(CASE WHEN type') && text.includes('balance')) {
      const userId = params?.[0];
      const userTx = transactions.filter(t => t.user_id === userId && t.status === 'completed');
      const incoming = userTx.filter(t => t.type === 'c2b' || t.type === 'stk_push').reduce((s, t) => s + parseFloat(t.amount as string || '0'), 0);
      const outgoing = userTx.filter(t => t.type === 'b2c' || t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount as string || '0'), 0);
      return { rows: [{ balance: (incoming - outgoing).toString() }], rowCount: 1 };
    }

    // Dashboard: total sales
    if (text.includes('total_sales') && !text.includes('this_month')) {
      const userId = params?.[0];
      const total = transactions.filter(t => t.user_id === userId && (t.type === 'c2b' || t.type === 'stk_push') && t.status === 'completed')
        .reduce((s, t) => s + parseFloat(t.amount as string || '0'), 0);
      return { rows: [{ total_sales: total.toString() }], rowCount: 1 };
    }

    // Dashboard: profits (MMF returns only — starts at 0)
    if (text.includes('this_month') && text.includes('last_month')) {
      const userId = params?.[0];
      const userInv = investments.filter(i => i.user_id === userId && (i.status === 'active' || i.status === 'matured'));
      const mmfReturns = userInv.reduce((s, i) => s + parseFloat(i.accrued_interest as string || '0'), 0);
      return { rows: [{ this_month: mmfReturns.toString(), last_month: '0' }], rowCount: 1 };
    }

    // Dashboard: weekly chart (computed from actual transactions)
    if (text.includes("to_char(created_at, 'Dy')")) {
      const userId = params?.[0];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      const userTx = transactions.filter(t =>
        t.user_id === userId && t.status === 'completed' &&
        new Date(t.created_at as string) >= sevenDaysAgo
      );

      const weeklyMap: Record<string, number> = {};
      for (const tx of userTx) {
        const d = new Date(tx.created_at as string);
        const dayName = dayNames[d.getDay()];
        weeklyMap[dayName] = (weeklyMap[dayName] || 0) + parseFloat(tx.amount as string || '0');
      }

      const result = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
        day,
        amount: (weeklyMap[day] || 0).toString(),
      }));
      return { rows: result, rowCount: 7 };
    }

    // Recent transactions
    if (text.includes('FROM transactions') && text.includes('ORDER BY') && text.includes('LIMIT')) {
      const userId = params?.[0];
      const userTx = transactions.filter(t => t.user_id === userId).slice(-5).reverse();
      return { rows: userTx, rowCount: userTx.length };
    }

    // COUNT for pagination
    if (sql.includes('COUNT(*)')) {
      const userId = params?.[0];
      const count = transactions.filter(t => t.user_id === userId).length;
      return { rows: [{ count: count.toString() }], rowCount: 1 };
    }

    // AI insights
    if (text.includes('FROM ai_insights')) {
      const userId = params?.[0];
      const found = aiInsights.filter(a => a.user_id === userId);
      if (found.length === 0) {
        return { rows: [{ content: 'Welcome to HazinaHub! Deposit funds to get started, then explore Money Market Funds in the Investments tab to grow your wealth.' }], rowCount: 1 };
      }
      return { rows: found, rowCount: found.length };
    }

    // MMF Funds
    if (text.includes('FROM mmf_funds')) {
      const active = mmfFunds.filter(f => f.is_active);
      return { rows: active, rowCount: active.length };
    }

    // Investments for user
    if (text.includes('FROM investments') && text.includes('JOIN mmf_funds')) {
      const userId = params?.[0];
      const userInv = investments.filter(i => i.user_id === userId).map(inv => {
        const fund = mmfFunds.find(f => f.id === inv.fund_id);
        return { ...inv, fund_name: fund?.name, provider: fund?.provider, interest_rate: fund?.interest_rate, risk_level: fund?.risk_level };
      });
      return { rows: userInv, rowCount: userInv.length };
    }

    // Portfolio summary
    if (text.includes('SUM(amount)') && text.includes('SUM(current_value)') && text.includes('SUM(accrued_interest)')) {
      const userId = params?.[0];
      const userInv = investments.filter(i => i.user_id === userId && (i.status === 'active' || i.status === 'matured'));
      const totalInvested = userInv.reduce((s, i) => s + parseFloat(i.amount as string || '0'), 0);
      const currentValue = userInv.reduce((s, i) => s + parseFloat(i.current_value as string || '0'), 0);
      const totalReturns = userInv.reduce((s, i) => s + parseFloat(i.accrued_interest as string || '0'), 0);
      return { rows: [{ total_invested: totalInvested.toString(), current_value: currentValue.toString(), total_returns: totalReturns.toString() }], rowCount: 1 };
    }

    // Portfolio snapshots
    if (text.includes('FROM portfolio_snapshots')) {
      return { rows: [], rowCount: 0 };
    }

    // Withdrawal eligible
    if (text.includes("status = 'matured'") && text.includes('SUM(current_value)')) {
      return { rows: [{ eligible: '0' }], rowCount: 1 };
    }

    // DISTINCT user_id from investments
    if (text.includes('DISTINCT user_id') && text.includes('FROM investments')) {
      const uniqueUsers = [...new Set(investments.map(i => i.user_id))];
      return { rows: uniqueUsers.map(uid => ({ user_id: uid })), rowCount: uniqueUsers.length };
    }

    // Revenue/expenses for AI
    if (text.includes('revenue') && text.includes('expenses') && text.includes('count')) {
      const userId = params?.[0];
      const userTx = transactions.filter(t => t.user_id === userId && t.status === 'completed');
      const revenue = userTx.filter(t => t.type === 'c2b' || t.type === 'stk_push').reduce((s, t) => s + parseFloat(t.amount as string || '0'), 0);
      const expenses = userTx.filter(t => t.type === 'b2c' || t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount as string || '0'), 0);
      return { rows: [{ revenue: revenue.toString(), expenses: expenses.toString(), count: userTx.length.toString() }], rowCount: 1 };
    }

    // Business name
    if (text.includes('business_name') && text.includes('FROM users')) {
      const userId = params?.[0];
      const found = users.find(u => u.id === userId);
      return { rows: [{ business_name: found?.business_name || 'My Business' }], rowCount: 1 };
    }

    // Auto-invest users
    if (text.includes('auto_invest_enabled')) {
      return { rows: [], rowCount: 0 };
    }

    // Fraud: failed transactions
    if (text.includes("status = 'failed'") && text.includes('HAVING')) {
      return { rows: [], rowCount: 0 };
    }

    // Fraud: large transactions
    if (text.includes('AVG(amount)')) {
      return { rows: [], rowCount: 0 };
    }

    // Fraud alerts check
    if (text.includes('FROM fraud_alerts')) {
      return { rows: [], rowCount: 0 };
    }

    // Phone lookup
    if (text.includes('phone') && text.includes('FROM users')) {
      const userId = params?.[0];
      const found = users.find(u => u.id === userId);
      return { rows: found ? [{ phone: found.phone }] : [], rowCount: found ? 1 : 0 };
    }

    // Generic select - return from table
    return { rows: table, rowCount: table.length };
  }

  // ─── UPDATE ────────────────────────────────────────────
  if (sql.startsWith('UPDATE')) {
    return { rows: [], rowCount: 1 };
  }

  // Default
  return { rows: [], rowCount: 0 };
}

export const mockGetClient = async () => ({
  query: mockQuery,
  release: () => {},
});

console.log('🟡 Running in MOCK MODE — using in-memory database (no PostgreSQL required)');
