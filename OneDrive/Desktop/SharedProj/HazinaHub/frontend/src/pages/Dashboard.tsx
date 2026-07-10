import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { DashboardSummary, ApiResponse, Cashflow } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { Wallet, TrendingUp, DollarSign, BrainCircuit, RefreshCw, AlertCircle, ShieldCheck, AlertTriangle, ArrowRight, Sparkles, Calculator } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projMonthly, setProjMonthly] = useState(5000);
  const [projYears, setProjYears] = useState(3);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<DashboardSummary>>('/dashboard');
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load dashboard summary');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--danger-glow)' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Failed to Load Dashboard</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'An unexpected error occurred.'}</p>
        <button className="btn btn-primary" onClick={fetchDashboardData}>
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    );
  }

  // Find category totals to compute Needs / Wants / Savings comparison
  const expensesList = data?.expensesByCategory || [];
  const totalExpenses = expensesList.reduce((acc, curr) => acc + curr.amount, 0);

  const needsAmount = expensesList
    .filter(e => ['rent', 'bills', 'food'].includes(e.category || ''))
    .reduce((sum, e) => sum + e.amount, 0);

  const wantsAmount = expensesList
    .filter(e => ['transport', 'airtime', 'other'].includes(e.category || ''))
    .reduce((sum, e) => sum + e.amount, 0);

  // Leakage Alert conditions
  const rentItem = expensesList.find(e => e.category === 'rent');
  const rentPercent = rentItem ? (rentItem.amount / (totalExpenses || 1)) * 100 : 0;
  const foodItem = expensesList.find(e => e.category === 'food');
  const foodPercent = foodItem ? (foodItem.amount / (totalExpenses || 1)) * 100 : 0;

  const leakAlerts: string[] = [];
  if (foodPercent > 30) {
    leakAlerts.push("Food/Groceries spending is high (> 30% of total outgoings). Check for subscription leakages or meal prep opportunities.");
  }
  if (rentPercent > 40) {
    leakAlerts.push("Rent exceeds 40% of your expenses. This leaves you vulnerable to cashflow shocks.");
  }
  const totalOutflowVsInflow = data && data.totalSales > 0 ? (totalExpenses / data.totalSales) * 100 : 0;
  if (totalOutflowVsInflow > 80) {
    leakAlerts.push("Your expenses exceed 80% of your business revenues. Consider reducing discretionary costs to build a safety buffer.");
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time business and wallet statistics.</p>
        </div>
        <button className="btn btn-glass" onClick={fetchDashboardData}>
          <RefreshCw size={16} /> Sync
        </button>
      </div>

      {/* AI Insight banner */}
      <div className="glass-panel ai-insight-banner" style={{ 
        padding: '24px', 
        marginBottom: '32px', 
        background: 'radial-gradient(100% 100% at 0% 0%, rgba(167, 139, 250, 0.15) 0%, var(--bg-surface) 100%)',
        borderLeft: '4px solid var(--primary)'
      }}>
        <div style={{
          background: 'var(--primary-glow)',
          padding: '12px',
          borderRadius: '12px',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <BrainCircuit size={28} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '4px', color: 'var(--text-main)' }}>Hazina AI Insight</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: '1.5' }}>
            "{data.aiInsight}"
          </p>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="dashboard-grid">
        {/* Card 1: Balance */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Monthly Cash Surplus</span>
            <Wallet size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">{formatKES(data.accountBalance)}</div>
          <div className="summary-subtext">
            <span className="text-success">Inflows - Outflows this month</span>
          </div>
        </div>

        {/* Card 2: Sales */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>24h Revenue</span>
            <TrendingUp size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{formatKES(data.totalSales)}</div>
          <div className="summary-subtext">
            <span className="text-success">Captured business inflows</span>
          </div>
        </div>

        {/* Card 3: Monthly profits */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Monthly Net Margin</span>
            <DollarSign size={20} color="var(--accent)" />
          </div>
          <div className="summary-value">{formatKES(data.monthlyProfits)}</div>
          <div className="summary-subtext">
            <span className={data.profitGrowth >= 0 ? "text-success" : "text-danger"}>
              {data.profitGrowth >= 0 ? '+' : ''}{data.profitGrowth}% from last month
            </span>
          </div>
        </div>

        {/* Card 4: Investments Yield */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Active MMF Yield</span>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">13.8%</div>
          <div className="summary-subtext">
            <span style={{ color: 'var(--text-muted)' }}>Kenyan MMF average</span>
          </div>
        </div>

        {/* Card 5: Financial Health */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Financial Health</span>
            <ShieldCheck size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{data.financialHealth.overall}%</div>
          <div className="summary-subtext" style={{ display: 'grid', gap: '4px' }}>
            <span style={{ color: 'var(--text-success)' }}>Cash flow: {data.financialHealth.cashFlow}%</span>
            <span>Debt ratio: {data.financialHealth.debtRatio}%</span>
          </div>
        </div>
      </div>

      <div className="dashboard-charts-layout">
        {/* Cashflow Volume Chart */}
        <div className="glass-panel" style={{ padding: '28px', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Cashflow Volume (7 Days)</h2>
          <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyCashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="var(--text-dark)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-dark)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `KES ${val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}`} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--primary)' }}
                  formatter={(value) => [formatKES(Number(value)), 'Volume']}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Cashflows List */}
        <div className="glass-panel" style={{ padding: '28px', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Recent Activity</h2>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {data.recentCashflows.length === 0 ? (
              <div style={{ color: 'var(--text-dark)', textAlign: 'center', padding: '40px 0' }}>No recent activity</div>
            ) : (
              data.recentCashflows.map((tx: Cashflow) => {
                const isInflow = tx.type === 'inflow' || tx.type === 'deposit' || tx.type === 'return' || tx.type === 'c2b' || tx.type === 'stk_push';
                return (
                  <div key={tx.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>
                        {isInflow ? 'Cash Inflow' : 'Cash Outflow'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                        {tx.receiptNumber ? tx.receiptNumber : `Ref: ${tx.id.substring(0, 8)}`} • {formatDate(tx.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontWeight: 700, 
                        fontSize: '0.95rem',
                        color: isInflow ? 'var(--primary)' : 'var(--danger)',
                        marginBottom: '4px'
                      }}>
                        {isInflow ? '+' : '-'}{formatKES(tx.amount)}
                      </div>
                      <span className={`badge ${
                        tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-pending' : 'badge-danger'
                      }`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '28px', marginTop: '32px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Cash Flow Trend</h2>
        <div style={{ width: '100%', height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.profitLossTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="var(--text-dark)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--text-dark)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `KES ${val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--primary)' }}
                formatter={(value: number, name: string) => [formatKES(Number(value)), name]}
              />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="var(--danger)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" stroke="var(--secondary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expenditures & AI Strategy Layout */}
      <div className="dashboard-charts-layout" style={{ marginTop: '32px' }}>
        {/* Left Column: AI Money Strategy & Compound Projection */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Sparkles size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>AI Money Allocation Strategy</h2>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
            Based on your monthly inflows (KES {formatKES(data.totalSales)}), Hazina AI recommends a <strong>50/30/20 Budgeting Rule</strong> to build resilience. Compare your current monthly categories to optimal targets:
          </p>

          {/* Budget Rule Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            {/* Needs */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Needs (50%)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Optimal</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                {formatKES(Math.max(0, needsAmount))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target: {formatKES(data.totalSales * 0.5)}
              </div>
              <div style={{ fontSize: '0.75rem', color: needsAmount > (data.totalSales * 0.5) ? 'var(--danger)' : 'var(--success)', marginTop: '4px' }}>
                {needsAmount > (data.totalSales * 0.5) ? 'Over target by ' + formatKES(needsAmount - (data.totalSales * 0.5)) : 'Within safe limits'}
              </div>
            </div>

            {/* Wants */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Wants (30%)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Optimal</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                {formatKES(Math.max(0, wantsAmount))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target: {formatKES(data.totalSales * 0.3)}
              </div>
              <div style={{ fontSize: '0.75rem', color: wantsAmount > (data.totalSales * 0.3) ? 'var(--danger)' : 'var(--success)', marginTop: '4px' }}>
                {wantsAmount > (data.totalSales * 0.3) ? 'Over target by ' + formatKES(wantsAmount - (data.totalSales * 0.3)) : 'Within safe limits'}
              </div>
            </div>

            {/* Savings/MMF */}
            <div style={{ background: 'rgba(139, 92, 246, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>Savings (20%)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Surplus</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
                {formatKES(Math.max(0, data.accountBalance))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target: {formatKES(data.totalSales * 0.2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: data.accountBalance >= (data.totalSales * 0.2) ? 'var(--success)' : 'var(--danger)', marginTop: '4px' }}>
                {data.accountBalance >= (data.totalSales * 0.2) ? 'Exceeding target savings!' : 'Deficit of ' + formatKES((data.totalSales * 0.2) - data.accountBalance)}
              </div>
            </div>
          </div>

          {/* Interactive Calculator Projections */}
          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calculator size={18} color="var(--secondary)" />
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>13.8% Yield Compound Growth Projection</h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Simulate regular monthly investments into Money Market Funds yielding the average rate of 13.8% p.a.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Monthly Contribution (KES): {formatKES(projMonthly)}
                </label>
                <input 
                  type="range" 
                  min="500" 
                  max="100000" 
                  step="500"
                  value={projMonthly} 
                  onChange={(e) => setProjMonthly(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
                <input 
                  type="number"
                  className="input-control"
                  style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                  value={projMonthly}
                  onChange={(e) => setProjMonthly(Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Duration: {projYears} {projYears === 1 ? 'Year' : 'Years'}
                </label>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="1"
                  value={projYears} 
                  onChange={(e) => setProjYears(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--secondary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>1 Yr</span>
                  <span>5 Yrs</span>
                  <span>10 Yrs</span>
                  <span>15 Yrs</span>
                </div>
              </div>
            </div>

            {/* Projection Results */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Invested</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatKES(projMonthly * projYears * 12)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Interest Earned</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--success)' }}>
                  {formatKES(Math.max(0, Math.round(projMonthly * ((Math.pow(1 + 0.138/12, projYears * 12) - 1) / (0.138/12)) * (1 + 0.138/12) - (projMonthly * projYears * 12))))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Maturity Value</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                  {formatKES(Math.round(projMonthly * ((Math.pow(1 + 0.138/12, projYears * 12) - 1) / (0.138/12)) * (1 + 0.138/12)))}
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              onClick={() => {
                // Trigger sidebar navigation change (which reacts to click or window location changes)
                const navBtn = document.querySelector('a[href="/investments"]') || Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent?.includes('Invest'));
                if (navBtn) {
                  (navBtn as HTMLElement).click();
                } else {
                  window.location.hash = '#investments';
                  window.location.reload();
                }
              }}
            >
              Start Investing Now <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Expenditures Breakdown & Leakage Alerts */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Expenditures Breakdown</h2>

          {totalExpenses === 0 ? (
            <div style={{ color: 'var(--text-dark)', padding: '40px 0', textAlign: 'center' }}>
              No recorded outflows in the last 30 days to analyze.
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '28px' }}>
                {expensesList.map((item) => {
                  const pct = (item.amount / totalExpenses) * 100;
                  let color = 'var(--text-dark)';
                  if (item.category === 'rent') color = 'var(--primary)';
                  else if (item.category === 'food') color = 'var(--secondary)';
                  else if (item.category === 'bills') color = 'var(--accent)';
                  else if (item.category === 'transport') color = 'var(--info)';
                  else if (item.category === 'airtime') color = 'var(--warning)';

                  return (
                    <div key={item.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {item.category}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {formatKES(item.amount)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leakage alerts */}
              {leakAlerts.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <AlertTriangle size={18} color="var(--warning)" />
                    <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>Leakage & Efficiency Alerts</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {leakAlerts.map((alert, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        background: 'rgba(245, 158, 11, 0.05)', 
                        border: '1px solid rgba(245, 158, 11, 0.15)', 
                        borderRadius: '8px', 
                        padding: '10px 12px',
                        fontSize: '0.8rem',
                        color: 'var(--accent)',
                        lineHeight: '1.4'
                      }}>
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
