import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { MMFund, Investment, Portfolio, ApiResponse } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { Briefcase, ArrowUpRight, TrendingUp, AlertCircle, Coins, Clock, X, BrainCircuit, Sparkles, Scale, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const FundLogo: React.FC<{ provider: string; logoUrl?: string; size?: number }> = ({ provider, logoUrl, size = 44 }) => {
  const [imgError, setImgError] = React.useState(false);
  const cleanProvider = provider.toLowerCase();
  
  console.log("[FundLogo]", { provider, logoUrl, imgError });

  const style = {
    width: size,
    height: size,
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  };

  if (logoUrl && !imgError) {
    return (
      <div style={{ ...style, background: '#ffffff', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <img 
          src={logoUrl} 
          alt={provider} 
          style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // 1. SANLAM INVESTMENTS
  if (cleanProvider.includes('sanlam')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #0a3054 0%, #005a9c 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" stroke="#ffffff" strokeWidth="4" opacity="0.3" />
          <path d="M50 15C30.67 15 15 30.67 15 50C15 57.5 17.36 64.44 21.36 70.18C25.3 64.3 33.2 60 50 60C62 60 72.5 64.5 77.2 71.3C82.08 65.48 85 58.08 85 50C85 30.67 69.33 15 50 15Z" fill="#ffffff" />
          <path d="M50 25C40 25 32 33 32 43C32 49 35.5 53.5 41 55.5C41.5 50.5 45.2 46.8 50 46.8C54.8 46.8 58.5 50.5 59 55.5C64.5 53.5 68 49 68 43C68 33 60 25 50 25Z" fill="#ffffff" opacity="0.9" />
          <circle cx="50" cy="43" r="7" fill="#005a9c" />
        </svg>
      </div>
    );
  }

  // 2. CIC GROUP / INSURANCE
  if (cleanProvider.includes('cic')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #094a47 0%, #0d9488 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10L10 80H90L50 10Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
          <path d="M50 22L20 75H80L50 22Z" fill="#ffffff" opacity="0.9" />
          <path d="M50 38L33 68H67L50 38Z" fill="#0d9488" />
          <circle cx="50" cy="55" r="5" fill="#fbbf24" />
        </svg>
      </div>
    );
  }

  // 3. ZIMELE / ZIIDI
  if (cleanProvider.includes('zimele')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #6b2108 0%, #9a3412 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="42" stroke="#fb923c" strokeWidth="4" strokeDasharray="6 4" />
          <path d="M72 25H28V36L50 62H28V73H72V62L50 36H72V25Z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 4. GENAFRICA
  if (cleanProvider.includes('genafrica')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #102a6b 0%, #1e40af 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 12C68 12 80 18 80 18V48C80 68 50 88 50 88C50 88 20 68 20 48V18C20 18 32 12 50 12Z" stroke="#fbbf24" strokeWidth="4" fill="none" />
          <path d="M50 22L62 38H38L50 22Z" fill="#fbbf24" />
          <path d="M50 72L65 56H35L50 72Z" fill="#ffffff" opacity="0.9" />
          <circle cx="50" cy="47" r="6" fill="#fbbf24" />
        </svg>
      </div>
    );
  }

  // 5. STIMA SACCO
  if (cleanProvider.includes('stima')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="4 2" />
          <path d="M35 68C30 60 28 50 32 40C36 30 45 22 55 22C68 22 75 32 75 42C75 48 70 55 60 58" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
          <path d="M65 32C70 40 72 50 68 60C64 70 55 78 45 78C32 78 25 68 25 58C25 52 30 45 40 42" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.7" />
          <path d="M55 12L35 52H52L45 88L70 42H50L55 12Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 6. KENYA POLICE SACCO
  if (cleanProvider.includes('police')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10L85 22V52C85 72 50 90 50 90C50 90 15 72 15 52V22L50 10Z" fill="#1e3a8a" stroke="#fbbf24" strokeWidth="4" />
          <path d="M50 20L58 35H74L61 45L66 62L50 51L34 62L39 45L26 35H42L50 20Z" fill="#fbbf24" />
          <circle cx="50" cy="42" r="8" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M35 70H65V76H35V70Z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 7. CENTRAL BANK OF KENYA (DHOWCSD)
  if (cleanProvider.includes('dhowcsd') || cleanProvider.includes('central bank') || cleanProvider.includes('cbk')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" fill="#d97706" stroke="#fbbf24" strokeWidth="3" />
          <circle cx="50" cy="50" r="38" fill="#15803d" stroke="#ffffff" strokeWidth="2" opacity="0.8" />
          <path d="M50 25C43 25 40 40 40 50C40 60 43 75 50 75C57 75 60 60 60 50C60 40 57 25 50 25Z" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
          <path d="M47 35H53V65H47V35Z" fill="#ffffff" />
          <path d="M32 68L68 32M32 32L68 68" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="5" fill="#fbbf24" />
        </svg>
      </div>
    );
  }

  // 8. SAFARICOM
  if (cleanProvider.includes('safaricom') && !cleanProvider.includes('co-op')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" fill="#ffffff" />
          <circle cx="50" cy="50" r="38" fill="#166534" />
          <path d="M46 22C34 24 28 35 28 47C28 62 38 72 50 72C62 72 68 62 68 52C68 47 65 42 60 38C52 32 52 28 55 24C58 20 65 24 67 29C64 24 58 19 50 19C48.5 19 47.2 20 46 22Z" fill="#ffffff" />
          <path d="M46 36C38 38 36 44 36 50C36 58 42 63 50 63C58 63 60 58 60 55C60 50 56 46 51 44C44 41 43 38 46 36Z" fill="#166534" />
          <path d="M50 14C70 14 86 30 86 50" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
          <path d="M14 50C14 30 30 14 50 14" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
        </svg>
      </div>
    );
  }

  // 9. EQUITY BANK
  if (cleanProvider.includes('equity')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #5c1c0c 0%, #7c2d12 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="42" width="70" height="46" fill="#ffffff" rx="6" />
          <rect x="25" y="52" width="12" height="24" fill="#7c2d12" rx="2" />
          <rect x="44" y="52" width="12" height="24" fill="#7c2d12" rx="2" />
          <rect x="63" y="52" width="12" height="24" fill="#7c2d12" rx="2" />
          <path d="M10 42L50 12L90 42H10Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 10. NCBA INVESTMENT BANK
  if (cleanProvider.includes('ncba')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #05261d 0%, #0b4c39 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* NCBA Stylized Gold/White N */}
          <path d="M25 20H37V60L63 20H75V80H63V40L37 80H25V20Z" fill="#ffffff" />
          <path d="M63 20L37 80H49L75 20H63Z" fill="#fbbf24" opacity="0.8" />
        </svg>
      </div>
    );
  }

  // 11. ICEA LION
  if (cleanProvider.includes('icea')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #092147 0%, #1e3a8a 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gold Lion Silhouette */}
          <path d="M45 25C40 25 35 30 35 37C35 45 42 48 48 52C42 55 32 58 28 65C38 68 45 68 52 64C56 68 62 70 70 70C65 65 60 55 60 45C60 35 55 25 45 25Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
          <circle cx="48" cy="38" r="3" fill="#ffffff" />
          <path d="M40 75H65V78H40V75Z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 12. CO-OP TRUST / CO-OP BANK
  if (cleanProvider.includes('co-op') || cleanProvider.includes('cooperative bank')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #094f27 0%, #15803d 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Green-white Co-op ribbon emblem */}
          <circle cx="50" cy="50" r="42" stroke="#ffffff" strokeWidth="5" fill="none" />
          <circle cx="50" cy="50" r="34" stroke="#fbbf24" strokeWidth="3.5" fill="none" strokeDasharray="10 5" />
          <path d="M35 50H65M50 35V65" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 13. HARAMBEE SACCO
  if (cleanProvider.includes('harambee')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)' }}>
        <svg width="65%" height="65%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Red Torch / Shake emblem */}
          <circle cx="50" cy="50" r="44" fill="#ffffff" opacity="0.1" />
          <path d="M50 15L35 38H65L50 15Z" fill="#fbbf24" />
          <path d="M50 38V75" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
          <path d="M40 50H60" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 14. KCB GROUP
  if (cleanProvider.includes('kcb')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #4d7c0f 0%, #65a30d 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bright Green + Gold Lion head crest */}
          <path d="M25 22L50 12L75 22V55C75 70 50 85 50 85C50 85 25 70 25 55V22Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="3" />
          <path d="M50 25C42 25 35 32 35 42C35 55 45 60 50 68C55 60 65 55 65 42C65 32 58 25 50 25Z" fill="#fbbf24" />
          <circle cx="46" cy="38" r="2.5" fill="#1e293b" />
          <circle cx="54" cy="38" r="2.5" fill="#1e293b" />
        </svg>
      </div>
    );
  }

  // 15. EABL (EAST AFRICAN BREWERIES)
  if (cleanProvider.includes('eabl') || cleanProvider.includes('breweries')) {
    return (
      <div style={{ ...style, background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' }}>
        <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gold Luxury Crown / Shield */}
          <circle cx="50" cy="50" r="44" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 3" />
          <path d="M22 68L30 32L50 48L70 32L78 68H22Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="30" cy="26" r="4" fill="#fbbf24" />
          <circle cx="50" cy="34" r="4" fill="#fbbf24" />
          <circle cx="70" cy="26" r="4" fill="#fbbf24" />
        </svg>
      </div>
    );
  }

  const initials = provider.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div style={{ ...style, background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)', color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
      {initials}
    </div>
  );
};

interface InvestmentsProps {
  onOpenPortal: (fund: MMFund, amount: string) => void;
}

const Investments: React.FC<InvestmentsProps> = ({ onOpenPortal }) => {
  const { refreshProfile, user } = useAuth();
  
  // Data State
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [funds, setFunds] = useState<MMFund[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'MMF' | 'SACCO' | 'T-Bill' | 'Stock'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [selectedFund, setSelectedFund] = useState<MMFund | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investError, setInvestError] = useState<string | null>(null);

  // AI Financial OS State
  const [incomeInput, setIncomeInput] = useState('15000');
  const [splitRule, setSplitRule] = useState<'50-30-20' | '60-20-10-10' | '70-15-15' | 'custom'>('50-30-20');
  const [customRuleText, setCustomRuleText] = useState('40-30-30');
  const [calcContribution, setCalcContribution] = useState(5000);
  const [calcDuration, setCalcDuration] = useState(3);
  const [calcFrequency, setCalcFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [allocationFundId, setAllocationFundId] = useState('');

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchData = async () => {
    if (!user) {
      setError('Please log in to view your investments.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const portfolioRes = await api.get<ApiResponse<Portfolio>>('/portfolio');
      if (portfolioRes.data.success && portfolioRes.data.data) {
        setPortfolio(portfolioRes.data.data);
      } else {
        throw new Error(portfolioRes.data.error || 'Failed to fetch portfolio summary');
      }

      const fundsRes = await api.get<ApiResponse<MMFund[]>>('/investments/funds');
      if (fundsRes.data.success && fundsRes.data.data) {
        setFunds(fundsRes.data.data);
      } else {
        throw new Error(fundsRes.data.error || 'Failed to fetch funds');
      }
    } catch (err: any) {
      console.error('Investments fetch error:', err);
      const apiError = err.response?.data?.error || err.response?.data?.detail || err.message || 'Server error occurred';
      setError(apiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchData();
  }, [user]);

  const getBudgetSplit = () => {
    const income = parseFloat(incomeInput) || 0;
    if (splitRule === '50-30-20') {
      return [
        { label: 'Essentials (50%)', amount: income * 0.5, color: 'var(--secondary)' },
        { label: 'Lifestyle (30%)', amount: income * 0.3, color: 'var(--accent)' },
        { label: 'Savings & MMF (20%)', amount: income * 0.2, color: 'var(--primary)' },
      ];
    } else if (splitRule === '60-20-10-10') {
      return [
        { label: 'Business & Living (60%)', amount: income * 0.6, color: 'var(--secondary)' },
        { label: 'MMF Investments (20%)', amount: income * 0.2, color: 'var(--primary)' },
        { label: 'Emergency Fund (10%)', amount: income * 0.1, color: 'var(--accent)' },
        { label: 'Personal Spending (10%)', amount: income * 0.1, color: 'var(--text-muted)' },
      ];
    } else if (splitRule === '70-15-15') {
      return [
        { label: 'Living Expenses (70%)', amount: income * 0.7, color: 'var(--secondary)' },
        { label: 'MMF Growth (15%)', amount: income * 0.15, color: 'var(--primary)' },
        { label: 'Emergency Reserve (15%)', amount: income * 0.15, color: 'var(--accent)' },
      ];
    } else {
      const parts = customRuleText
        .split('-')
        .map(x => parseFloat(x.trim()))
        .filter(x => !isNaN(x) && x > 0);
      
      if (parts.length === 0) {
        return [{ label: 'Enter split ratios (e.g. 40-30-30)', amount: income, color: 'var(--text-muted)' }];
      }
      
      const sum = parts.reduce((a, b) => a + b, 0);
      const colors = ['var(--secondary)', 'var(--accent)', 'var(--primary)', 'var(--text-muted)', '#f59e0b', '#3b82f6'];
      
      return parts.map((part, index) => {
        const pct = (part / sum) * 100;
        let label = `Category ${index + 1} (${pct.toFixed(0)}%)`;
        if (parts.length === 3) {
          if (index === 0) label = `Essentials (${pct.toFixed(0)}%)`;
          else if (index === 1) label = `Lifestyle (${pct.toFixed(0)}%)`;
          else if (index === 2) label = `Savings & MMF (${pct.toFixed(0)}%)`;
        } else if (parts.length === 4) {
          if (index === 0) label = `Business & Living (${pct.toFixed(0)}%)`;
          else if (index === 1) label = `MMF Investments (${pct.toFixed(0)}%)`;
          else if (index === 2) label = `Emergency Fund (${pct.toFixed(0)}%)`;
          else if (index === 3) label = `Personal Spending (${pct.toFixed(0)}%)`;
        }
        return {
          label,
          amount: income * (part / sum),
          color: colors[index % colors.length]
        };
      });
    }
  };

  const calculateGrowth = () => {
    const rateDecimal = 14.0 / 100; // 14% p.a. average
    let periodsPerYear = 12;
    let totalPeriods = calcDuration * 12;
    let periodContribution = calcContribution;
    
    if (calcFrequency === 'daily') {
      periodsPerYear = 365;
      totalPeriods = calcDuration * 365;
    } else if (calcFrequency === 'weekly') {
      periodsPerYear = 52;
      totalPeriods = calcDuration * 52;
    }
    
    const ratePerPeriod = rateDecimal / periodsPerYear;
    
    let currentBalance = 0;
    let principal = 0;
    const chartData = [];
    
    for (let period = 1; period <= totalPeriods; period++) {
      principal += periodContribution;
      currentBalance = (currentBalance + periodContribution) * (1 + ratePerPeriod);
      
      const isYearEnd = period % Math.round(periodsPerYear) === 0;
      const isLastPeriod = period === totalPeriods;
      
      if (isYearEnd || isLastPeriod) {
        const yearNum = Math.ceil(period / periodsPerYear);
        chartData.push({
          name: `Yr ${yearNum}`,
          Invested: Math.round(principal),
          Growth: Math.round(currentBalance),
          Interest: Math.round(currentBalance - principal)
        });
      }
    }
    return {
      chartData,
      finalBalance: Math.round(currentBalance),
      finalPrincipal: Math.round(principal),
      finalInterest: Math.round(currentBalance - principal)
    };
  };

  const handleInvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return;
    
    const amountNum = parseFloat(investAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setInvestError('Please enter a valid investment amount');
      return;
    }

    if (amountNum < selectedFund.minimumInvestment) {
      setInvestError(`Minimum investment is KES ${selectedFund.minimumInvestment.toLocaleString()}`);
      return;
    }

    setInvestError(null);
    setShowInvestModal(false);
    onOpenPortal(selectedFund, investAmount);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;

    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount');
      return;
    }

    if (amountNum > selectedInvestment.currentValue) {
      setWithdrawError(`Maximum withdrawal is ${formatKES(selectedInvestment.currentValue)}`);
      return;
    }

    setWithdrawError(null);
    setWithdrawing(true);

    try {
      const response = await api.post<ApiResponse<any>>('/portfolio/withdraw', {
        investment_id: selectedInvestment.id,
        amount: amountNum
      });

      if (response.data.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setSelectedInvestment(null);
        await Promise.all([fetchData(), refreshProfile()]);
      } else {
        setWithdrawError(response.data.error || 'Withdrawal request failed');
      }
    } catch (err: any) {
      setWithdrawError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

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

  if (error || !portfolio) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--danger-glow)' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Failed to Load Investments</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'An unexpected error occurred.'}</p>
        <button className="btn btn-primary" onClick={fetchData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Investments & Portals</h1>
          <p style={{ color: 'var(--text-muted)' }}>Grow and track your business capital across Kenyan wealth asset classes.</p>
        </div>
      </div>

      {/* Portfolio Holdings Summary */}
      <div className="dashboard-grid">
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Portfolio Value</span>
            <Briefcase size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.currentValue)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Total capital + returns</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Principal Invested</span>
            <Coins size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.totalInvested)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Net deposits to funds</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Accrued Returns</span>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
          <div className="summary-value" style={{ color: 'var(--primary)' }}>+{formatKES(portfolio.totalReturns)}</div>
          <div className="summary-subtext">
            <span className="text-success">+{portfolio.yieldPercentage}% total growth</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Withdrawal Eligible</span>
            <Clock size={20} color="var(--accent)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.withdrawalEligible)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Matured investments only</span>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      {portfolio.growthData && portfolio.growthData.length > 0 && (
        <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Portfolio Growth History</h2>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolio.growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-dark)" fontSize={12} tickFormatter={(val) => formatDate(val, { month: 'short', day: 'numeric' })} />
                <YAxis stroke="var(--text-dark)" fontSize={12} axisLine={false} tickFormatter={(val) => `KES ${val.toLocaleString()}`} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--secondary)' }}
                  formatter={(value) => [formatKES(Number(value)), 'Value']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI Financial Decision Hub */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '32px' }}>
        <BrainCircuit size={28} color="var(--primary)" />
        <h2 style={{ fontSize: '1.75rem', margin: 0 }}>AI Financial Decision Hub</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {/* Card 1: Smart Budget Splitter */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={20} color="var(--primary)" /> Smart Budget Splitter
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              AI ASSISTED
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Input any amount of money (e.g. income or wallet balance). We will calculate allocation splits to optimize your funds.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="incomeInput">Amount to Split (KES)</label>
              <input
                type="number"
                id="incomeInput"
                className="input-control"
                placeholder="e.g. 15000"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="splitRule">Allocation Rule</label>
              <select
                id="splitRule"
                className="input-control"
                value={splitRule}
                onChange={(e: any) => setSplitRule(e.target.value)}
                style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)' }}
              >
                <option value="50-30-20">50/30/20 Savings Rule</option>
                <option value="60-20-10-10">60/20/10/10 Founder Split</option>
                <option value="70-15-15">70/15/15 Safe Buffer</option>
                <option value="custom">Custom Rule...</option>
              </select>
            </div>
            {splitRule === 'custom' && (
              <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '12px', marginBottom: 0 }}>
                <label className="form-label" htmlFor="customRuleInput">Custom Rule Ratios (hyphen-separated, e.g. 40-30-30)</label>
                <input
                  type="text"
                  id="customRuleInput"
                  className="input-control"
                  placeholder="e.g. 40-30-30"
                  value={customRuleText}
                  onChange={(e) => setCustomRuleText(e.target.value)}
                  style={{ padding: '10px 14px' }}
                />
              </div>
            )}
          </div>

          {/* Allocation visualizer bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {getBudgetSplit().map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700 }}>{formatKES(item.amount)}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(item.amount / (parseFloat(incomeInput) || 1)) * 100}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Allocation decision helper & Quick invest action */}
          <div style={{ 
            background: 'var(--primary-glow)', 
            border: '1px dashed rgba(16, 185, 129, 0.3)', 
            borderRadius: '10px', 
            padding: '16px', 
            fontSize: '0.85rem', 
            lineHeight: '1.45', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px' 
          }}>
            <div style={{ color: 'var(--text-main)' }}>
              <Sparkles size={16} color="var(--primary)" style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '6px' }} />
              <strong>AI Recommendation:</strong> With an amount of <strong>{formatKES(parseFloat(incomeInput) || 0)}</strong> to split, 
              we recommend setting aside <strong>{formatKES(getBudgetSplit().find(x => x.label.includes('MMF') || x.label.includes('Savings'))?.amount || 0)}</strong> for investing. 
              You can deploy this allocation across available Money Market Funds below to grow your returns.
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="input-control"
                value={allocationFundId}
                onChange={(e) => setAllocationFundId(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8125rem', minWidth: '150px', background: 'var(--bg-surface)' }}
              >
                <option value="">Select target asset...</option>
                {funds.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.interestRate}%)</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                disabled={!allocationFundId}
                onClick={() => {
                  const targetFund = funds.find(f => f.id === allocationFundId);
                  if (targetFund) {
                    const recAmount = getBudgetSplit().find(x => x.label.includes('MMF') || x.label.includes('Savings'))?.amount || 0;
                    setSelectedFund(targetFund);
                    setInvestAmount(String(Math.max(targetFund.minimumInvestment, Math.round(recAmount))));
                    setShowInvestModal(true);
                  }
                }}
              >
                Deploy Allocation <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Wealth growth simulator */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <TrendingUp size={20} color="var(--secondary)" /> Wealth Growth Simulator
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', background: 'var(--secondary-glow)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              COMPOUND INTEREST
            </span>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Contribution</span>
                <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{formatKES(calcContribution)}</span>
              </label>
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={calcContribution}
                onChange={(e) => setCalcContribution(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--secondary)', height: '6px', cursor: 'pointer' }}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 90px' }}>
              <label className="form-label">Frequency</label>
              <select
                className="input-control"
                value={calcFrequency}
                onChange={(e: any) => setCalcFrequency(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)' }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 100px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Duration</span>
                <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{calcDuration} Yrs</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={calcDuration}
                onChange={(e) => setCalcDuration(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--secondary)', height: '6px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div className="simulator-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Balance</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatKES(calculateGrowth().finalBalance)}
                </div>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interest Accrued</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                  +{formatKES(calculateGrowth().finalInterest)}
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={calculateGrowth().chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="var(--text-dark)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--text-dark)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `K${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '6px', fontSize: '10px' }}
                    labelStyle={{ color: 'var(--text-main)' }}
                    formatter={(value) => [formatKES(Number(value)), '']}
                  />
                  <Area type="monotone" dataKey="Invested" stackId="1" stroke="var(--secondary)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorInvested)" />
                  <Area type="monotone" dataKey="Growth" stackId="2" stroke="var(--primary)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorGrowth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Info size={12} />
            <span>Calculated at 14.0% average annual return compounded daily. Real rates will fluctuate.</span>
          </div>
        </div>
      </div>

      {/* Available Funds section */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Browse Available Assets</h2>
      
      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        {[
          { id: 'all', label: 'All Assets' },
          { id: 'MMF', label: 'Money Market Funds (MMFs)' },
          { id: 'SACCO', label: 'SACCO Deposits' },
          { id: 'T-Bill', label: 'Treasury Bills (T-Bills)' },
          { id: 'Stock', label: 'Blue-Chip Stocks' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`btn ${activeCategory === tab.id ? 'btn-primary' : 'btn-glass'}`}
            style={{ padding: '8px 16px', fontSize: '0.875rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {funds
          .filter(f => activeCategory === 'all' ? true : f.assetClass === activeCategory)
          .map((fund) => (
            <div key={fund.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <FundLogo provider={fund.provider} logoUrl={fund.logoUrl} />
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{fund.name}</h3>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>by {fund.provider}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', lineHeight: '1' }}>
                    {fund.interestRate}%
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    {fund.assetClass === 'Stock' ? 'EXPECTED YIELD' : 'ANNUAL YIELD'}
                  </span>
                  <span className="badge badge-glass" style={{ fontSize: '0.65rem' }}>{fund.assetClass}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ color: 'var(--text-dark)', marginBottom: '4px' }}>Risk Level</div>
                  <span className={`badge ${
                    fund.riskLevel === 'sovereign' ? 'badge-success' : fund.riskLevel === 'low' ? 'badge-success' : fund.riskLevel === 'medium' ? 'badge-pending' : 'badge-danger'
                  }`} style={{ fontSize: '0.7rem', border: fund.riskLevel === 'sovereign' ? '1px solid rgba(16, 185, 129, 0.4)' : undefined }}>
                    {fund.riskLevel}
                  </span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dark)', marginBottom: '4px' }}>Min. Invest</div>
                  <div style={{ fontWeight: 600 }}>{formatKES(fund.minimumInvestment)}</div>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => {
                  setSelectedFund(fund);
                  setShowInvestModal(true);
                }}
              >
                Invest Capital <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
      </div>

      {/* Kenyan Asset Class Comparison Matrix */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '32px' }}>
        <Scale size={24} color="var(--primary)" />
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Kenyan Wealth Asset Classes</h2>
      </div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', margin: 0 }}>
          Compare Money Market Funds (MMFs) with other leading investment vehicles in Kenya to find the right tool for your goals.
        </p>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset Class</th>
                <th>Avg. Return Yield</th>
                <th>Lock-In Period</th>
                <th>Withdrawal Speed</th>
                <th>Min. Investment</th>
                <th>Risk Level</th>
                <th>Best Suited For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Money Market Funds (MMFs)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>e.g. ZIIDI, Sanlam, CIC</div>
                </td>
                <td style={{ fontWeight: 600 }}>11% – 15% p.a.</td>
                <td>None (No penalty)</td>
                <td>Instant to 48 Hours</td>
                <td>KES 100 – KES 5,000</td>
                <td>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Low</span>
                </td>
                <td>Emergency funds, operating cash buffer, short-term savings</td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>SACCO Shares & Deposits</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>e.g. Stima, Kenya Police</div>
                </td>
                <td style={{ fontWeight: 600 }}>12% – 15% dividends</td>
                <td>Permanent shares (can only sell)</td>
                <td>60-Day Notice (Deposits)</td>
                <td>KES 1,000 – KES 3,000 / month</td>
                <td>
                  <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Medium</span>
                </td>
                <td>Medium-term asset accumulation, borrowing credit multiplier</td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Treasury Bills (T-Bills)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>CBK DhowCSD Portal</div>
                </td>
                <td style={{ fontWeight: 600 }}>15% – 17% p.a.</td>
                <td>91, 182, or 364 Days</td>
                <td>Upon Maturity Only</td>
                <td>KES 50,000</td>
                <td>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--primary)' }}>Sovereign</span>
                </td>
                <td>Locked capital, high yield guaranteed short-term savings</td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>NSE Blue-Chip Stocks</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>e.g. Safaricom, Equity Bank</div>
                </td>
                <td style={{ fontWeight: 600 }}>Variable (Capital gains + 4-8% dividends)</td>
                <td>None (Market trading hours)</td>
                <td>T+3 Days settlement</td>
                <td>Minimum 100 shares</td>
                <td>
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>High</span>
                </td>
                <td>Long-term wealth building, inflation hedge</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
 
      {/* Active Holdings section */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Active Portfolio Holdings</h2>
      <div className="glass-panel" style={{ padding: '24px' }}>
        {portfolio.investments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            You do not have any active investments. Select an asset above to start growing your funds.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset / Fund</th>
                  <th>Yield Rate</th>
                  <th>Principal</th>
                  <th>Accrued Returns</th>
                  <th>Current Value</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.investments.map((inv: Investment) => (
                  <tr key={inv.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <FundLogo provider={(inv as any).provider || ''} logoUrl={(inv as any).logoUrl} size={32} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontWeight: 600 }}>{(inv as any).fundName}</div>
                            {inv.assetClass && (
                              <span className="badge badge-glass" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                                {inv.assetClass}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{(inv as any).provider}</div>
                        </div>
                      </div>
                    </td>
                    <td>{(inv as any).interestRate}%</td>
                    <td>{formatKES(inv.amount)}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 600 }}>+{formatKES(inv.accruedInterest)}</td>
                    <td style={{ fontWeight: 700 }}>{formatKES(inv.currentValue)}</td>
                    <td>
                      <span className={`badge ${
                        inv.status === 'active' ? 'badge-pending' : inv.status === 'matured' ? 'badge-success' : 'badge-danger'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Invested: {formatDate(inv.investedAt)}</div>
                      {inv.maturesAt && <div>Matures: {formatDate(inv.maturesAt)}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        onClick={() => {
                          setSelectedInvestment(inv);
                          setShowWithdrawModal(true);
                        }}
                      >
                        Sync Withdrawal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invest Modal */}
      {showInvestModal && selectedFund && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel responsive-modal-padding">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem' }}>Invest in {selectedFund.name}</h3>
              <button 
                onClick={() => {
                  setShowInvestModal(false);
                  setInvestError(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {investError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {investError}
              </div>
            )}

            <form onSubmit={handleInvestSubmit}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fund Yield:</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedFund.interestRate}% P.A.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Minimum Deposit:</span>
                  <span style={{ fontWeight: 600 }}>{formatKES(selectedFund.minimumInvestment)}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <Info size={14} style={{ marginRight: '6px', verticalAlign: 'text-bottom', display: 'inline-block' }} />
                  Hazina Hub is a decision layer. To execute this investment, dial the provider's USSD code or visit their platform.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="investAmount">Amount to Track (KES)</label>
                <input
                  type="number"
                  id="investAmount"
                  className="input-control"
                  placeholder={`Min. ${selectedFund.minimumInvestment}`}
                  min={selectedFund.minimumInvestment}
                  step={1}
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  Proceed to Sandbox Portal <ArrowUpRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && selectedInvestment && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel responsive-modal-padding">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem' }}>MMF Fund Withdrawal</h3>
              <button 
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {withdrawError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>MMF Source:</span>
                  <span style={{ fontWeight: 600 }}>{(selectedInvestment as any).fundName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Eligible Value:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatKES(selectedInvestment.currentValue)}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <Info size={14} style={{ marginRight: '6px', verticalAlign: 'text-bottom', display: 'inline-block' }} />
                  Please request your actual cash withdrawal directly on the provider's platform first.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="withdrawAmount">Amount to Sync (KES)</label>
                <input
                  type="number"
                  id="withdrawAmount"
                  className="input-control"
                  placeholder="e.g. 5000"
                  max={selectedInvestment.currentValue}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={withdrawing}
              >
                {withdrawing ? 'Updating tracker...' : 'Sync Withdrawal in Portfolio'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
