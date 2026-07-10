import React, { useState } from 'react';
import api from '../services/api';
import type { MMFund, ApiResponse } from '@hazinahub/types';
import { formatKES } from '@hazinahub/utils';
import { 
  ArrowLeft, 
  Lock, 
  ExternalLink, 
  Smartphone, 
  Globe, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { FundLogo } from './Investments'; // Re-use the existing logo component

interface PortalProps {
  fund: MMFund | null;
  initialAmount: string;
  onBack: () => void;
  onSuccess: () => void;
}

const Portal: React.FC<PortalProps> = ({ fund, initialAmount, onBack, onSuccess }) => {
  if (!fund) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3>No Investment Fund Selected</h3>
        <p style={{ color: 'var(--text-muted)' }}>Please select a Money Market Fund to invest in.</p>
        <button className="btn btn-primary" onClick={onBack}>
          Back to Investments
        </button>
      </div>
    );
  }

  // Configurations
  const [portalMode, setPortalMode] = useState<'sandbox' | 'live'>('sandbox');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form & Simulator State
  const [investAmount, setInvestAmount] = useState(initialAmount || String(fund.minimumInvestment));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'pin_prompt' | 'processing' | 'success'>('idle');
  const [mpesaPin, setMpesaPin] = useState('');

  // Provider branding styling variables
  const getProviderTheme = () => {
    const provider = fund.provider.toLowerCase();
    if (provider.includes('sanlam')) {
      return {
        primary: '#0a3054',
        secondary: '#005a9c',
        accent: '#fbbf24',
        textLight: '#ffffff',
        textDark: '#0a3054'
      };
    } else if (provider.includes('cic')) {
      return {
        primary: '#094a47',
        secondary: '#0d9488',
        accent: '#fbbf24',
        textLight: '#ffffff',
        textDark: '#094a47'
      };
    } else if (provider.includes('zimele')) {
      return {
        primary: '#6b2108',
        secondary: '#9a3412',
        accent: '#fb923c',
        textLight: '#ffffff',
        textDark: '#6b2108'
      };
    } else if (provider.includes('genafrica')) {
      return {
        primary: '#102a6b',
        secondary: '#1e40af',
        accent: '#fbbf24',
        textLight: '#ffffff',
        textDark: '#102a6b'
      };
    } else if (provider.includes('stima')) {
      return {
        primary: '#14532d',
        secondary: '#15803d',
        accent: '#fbbf24',
        textLight: '#ffffff',
        textDark: '#14532d'
      };
    } else if (provider.includes('police')) {
      return {
        primary: '#0f172a',
        secondary: '#1e3a8a',
        accent: '#fbbf24',
        textLight: '#ffffff',
        textDark: '#0f172a'
      };
    } else if (provider.includes('dhowcsd') || provider.includes('central bank') || provider.includes('cbk')) {
      return {
        primary: '#78350f',
        secondary: '#d97706',
        accent: '#10b981',
        textLight: '#ffffff',
        textDark: '#78350f'
      };
    } else if (provider.includes('safaricom')) {
      return {
        primary: '#14532d',
        secondary: '#15803d',
        accent: '#ef4444',
        textLight: '#ffffff',
        textDark: '#14532d'
      };
    } else if (provider.includes('equity')) {
      return {
        primary: '#5c1c0c',
        secondary: '#7c2d12',
        accent: '#ef4444',
        textLight: '#ffffff',
        textDark: '#5c1c0c'
      };
    }
    return {
      primary: '#8b5cf6',
      secondary: '#7c3aed',
      accent: '#d97706',
      textLight: '#ffffff',
      textDark: '#1e293b'
    };
  };

  const theme = getProviderTheme();

  // USSD code mappings
  const getUSSDCode = () => {
    const provider = fund.provider.toLowerCase();
    if (provider.includes('cic')) return '*483*55#';
    if (provider.includes('sanlam')) return '*483*81#';
    if (provider.includes('zimele')) return '*483*60#';
    if (provider.includes('stima')) return '*483*70#';
    if (provider.includes('police')) return '*483*90#';
    if (provider.includes('dhowcsd') || provider.includes('central bank')) return '*866#';
    if (provider.includes('safaricom') || provider.includes('equity')) return '*150#';
    return '*483*100#';
  };

  // Perform backend investment log integration
  const handleRegisterInvestment = async (amountToLog: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<ApiResponse<any>>('/investments/invest', {
        fund_id: fund.id,
        amount: amountToLog,
        phone: phoneNumber || undefined
      });

      if (response.data.success) {
        setSuccessMsg(response.data.data?.message || `KES ${amountToLog.toLocaleString()} investment successfully logged!`);
        onSuccess(); // refresh parent state
      } else {
        setError(response.data.error || 'Failed to sync investment transaction.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSTKPush = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(investAmount);
    if (isNaN(amountNum) || amountNum < fund.minimumInvestment) {
      setError(`Minimum investment is KES ${fund.minimumInvestment.toLocaleString()}`);
      return;
    }
    setError(null);
    setStkStatus('sending');

    setTimeout(() => {
      setStkStatus('pin_prompt');
    }, 1500);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mpesaPin.length !== 4) {
      setError('Please enter a valid 4-digit PIN');
      return;
    }
    setError(null);
    setStkStatus('processing');

    setTimeout(() => {
      setStkStatus('success');
      const amountNum = parseFloat(investAmount);
      handleRegisterInvestment(amountNum);
    }, 2000);
  };

  const handleManualSync = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(investAmount);
    if (isNaN(amountNum) || amountNum < fund.minimumInvestment) {
      setError(`Minimum investment is KES ${fund.minimumInvestment.toLocaleString()}`);
      return;
    }
    handleRegisterInvestment(amountNum);
  };

  return (
    <div>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <button className="btn btn-glass" onClick={onBack} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
            <ArrowLeft size={16} /> Back to Investments
          </button>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-glass)' }}>
            <button 
              className="btn" 
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.8125rem', 
                borderRadius: '8px',
                background: portalMode === 'sandbox' ? 'var(--primary-glow)' : 'transparent',
                color: portalMode === 'sandbox' ? 'var(--primary)' : 'var(--text-muted)'
              }}
              onClick={() => { setPortalMode('sandbox'); setError(null); }}
            >
              <Smartphone size={14} /> Interactive Sandbox
            </button>
            <button 
              className="btn" 
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.8125rem', 
                borderRadius: '8px',
                background: portalMode === 'live' ? 'var(--primary-glow)' : 'transparent',
                color: portalMode === 'live' ? 'var(--primary)' : 'var(--text-muted)'
              }}
              onClick={() => { setPortalMode('live'); setError(null); }}
            >
              <Globe size={14} /> Live Official Website
            </button>
          </div>
        </div>

        {/* Address URL Simulator Bar */}
        <div className="glass-panel" style={{ 
          padding: '10px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          border: '1px solid var(--border-glass)',
          fontSize: '0.875rem',
          background: 'rgba(0, 0, 0, 0.01)'
        }}>
          <Lock size={14} color="var(--success)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SECURE
          </span>
          <div style={{ 
            flex: 1, 
            fontFamily: 'monospace', 
            fontSize: '0.825rem', 
            background: 'rgba(255,255,255,0.02)', 
            padding: '4px 12px', 
            borderRadius: '6px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            border: '1px solid rgba(0,0,0,0.02)'
          }}>
            {portalMode === 'sandbox' 
              ? `https://sandbox.hazinahub.com/gateways/${fund.provider.toLowerCase().replace(/\s+/g, '-')}` 
              : fund.websiteUrl || 'https://www.hazinahub.com'
            }
          </div>
          {fund.websiteUrl && (
            <button 
              className="btn btn-glass" 
              style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
              onClick={() => window.open(fund.websiteUrl, '_blank')}
            >
              External <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="dashboard-charts-layout">
        {/* Left Side: Simulation Screen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {portalMode === 'live' ? (
            /* LIVE OFFICIAL WEBSITE FRAME */
            <div className="glass-panel" style={{ padding: '28px', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'var(--primary-glow)', border: '1px dashed var(--primary)', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '0.85rem', lineHeight: '1.45', display: 'flex', gap: '10px' }}>
                <ShieldAlert size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Embedding Official Portal:</strong> Note that some financial institutions restrict embedding their live application dashboard in an iframe due to Content Security Policies. If the view below does not load, click <strong>"Open Official Portal in New Window"</strong> on the right sidebar companion.
                </div>
              </div>

              {fund.websiteUrl ? (
                <div style={{ flex: 1, border: '1px solid var(--border-glass)', borderRadius: '8px', overflow: 'hidden', minHeight: '400px', background: '#ffffff' }}>
                  <iframe 
                    src={fund.websiteUrl} 
                    title={`${fund.name} Website`}
                    style={{ width: '100%', height: '100%', border: 'none', minHeight: '400px' }}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  No official website URL provided for this fund.
                </div>
              )}
            </div>
          ) : (
            /* INTERACTIVE SANDBOX MOCK PORTAL */
            <div className="glass-panel" style={{ 
              minHeight: '500px', 
              background: theme.primary,
              color: theme.textLight,
              borderRadius: 'var(--card-radius)',
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {/* Sandbox App Header */}
              <div style={{ 
                padding: '18px 24px', 
                background: 'rgba(0,0,0,0.2)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FundLogo provider={fund.provider} logoUrl={fund.logoUrl} size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{fund.provider} Sandbox</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={10} /> Secure Checkout API v2
                    </div>
                  </div>
                </div>
                <div style={{ background: theme.accent, color: '#000000', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                  DEMO SURROUND
                </div>
              </div>

              {/* Sandbox Screen Body */}
              <div style={{ flex: 1, padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                
                {/* Error Banner inside Sandbox */}
                {error && (
                  <div style={{ width: '100%', maxWidth: '380px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Step 1: Simulated Portal Login */}
                {!isAuthenticated && (
                  <div style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.15)', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', textAlign: 'center' }}>Portal Account Authentication</h3>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: '24px' }}>
                      Authenticate using your business line or Hazina ID to connect to the {fund.assetClass || 'MMF'} sandbox gateway.
                    </p>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Hazina Phone Number / ID</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        placeholder="e.g. 0712345678" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                      />
                    </div>

                    <button 
                      className="btn" 
                      style={{ width: '100%', background: theme.accent, color: '#000000', padding: '12px', marginTop: '8px' }}
                      onClick={() => {
                        if (!phoneNumber) {
                          setError('Please input your phone number to authenticate');
                          return;
                        }
                        setError(null);
                        setIsAuthenticated(true);
                      }}
                    >
                      Login to {fund.provider} <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Step 2: STK Push Simulator */}
                {isAuthenticated && stkStatus === 'idle' && (
                  <div style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.15)', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        MMF Capital Top Up
                      </span>
                      <h3 style={{ fontSize: '1.4rem', color: theme.accent, marginTop: '4px' }}>{fund.name}</h3>
                    </div>

                    <form onSubmit={handleSimulateSTKPush}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Investment Amount (KES)</label>
                        <input 
                          type="number" 
                          className="input-control" 
                          min={fund.minimumInvestment}
                          value={investAmount}
                          onChange={(e) => setInvestAmount(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1.25rem', fontWeight: 700 }}
                          required
                        />
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                          Min: {formatKES(fund.minimumInvestment)} | Yield: {fund.interestRate}%
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>M-Pesa Payer Number</label>
                        <input 
                          type="tel" 
                          className="input-control" 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                          required
                        />
                      </div>

                      <button 
                        type="submit" 
                        className="btn" 
                        style={{ width: '100%', background: theme.accent, color: '#000000', padding: '12px', marginTop: '10px' }}
                      >
                        Simulate STK Push Deposit
                      </button>
                    </form>
                  </div>
                )}

                {/* Step 3: Wait Spinner (Sending STK push) */}
                {stkStatus === 'sending' && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 20px', color: theme.accent, animation: 'spin 1.5s linear infinite' }} />
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Initializing Gateway Session</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                      Connecting to Safaricom network API to trigger STK push on {phoneNumber}...
                    </p>
                  </div>
                )}

                {/* Step 4: PIN Entry Pop-up Dialog */}
                {stkStatus === 'pin_prompt' && (
                  <div style={{ 
                    width: '100%', 
                    maxWidth: '320px', 
                    background: '#ffffff', 
                    color: '#000000',
                    padding: '24px', 
                    borderRadius: '20px', 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '4px solid #10b981',
                    position: 'relative',
                    animation: 'modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '10px' }}>
                      <Smartphone size={16} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>SIMULATED M-PESA STK PUSH</span>
                    </div>

                    <p style={{ fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
                      Do you want to pay KES <strong>{parseFloat(investAmount).toLocaleString()}</strong> to <strong>{fund.provider}</strong>? Enter your M-Pesa PIN:
                    </p>

                    <form onSubmit={handleConfirmPin}>
                      <input 
                        type="password" 
                        maxLength={4}
                        className="input-control" 
                        placeholder="••••"
                        value={mpesaPin}
                        onChange={(e) => setMpesaPin(e.target.value.replace(/\D/g, ''))}
                        style={{ 
                          textAlign: 'center', 
                          fontSize: '1.5rem', 
                          letterSpacing: '0.4em', 
                          background: '#f3f4f6', 
                          border: '2px solid #d1d5db', 
                          color: '#000000',
                          padding: '10px 0',
                          marginBottom: '16px' 
                        }}
                        autoFocus
                        required
                      />

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          type="button" 
                          className="btn btn-glass" 
                          style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                          onClick={() => setStkStatus('idle')}
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          className="btn" 
                          style={{ flex: 2, background: '#10b981', color: 'white', padding: '8px', fontSize: '0.85rem' }}
                        >
                          Send PIN
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Step 5: Processing Deposit */}
                {stkStatus === 'processing' && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 20px', color: '#10b981', animation: 'spin 1.5s linear infinite' }} />
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Processing Sandbox Transaction</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                      PIN received. Reconciling transaction logs and notifying Hazina Hub ledger...
                    </p>
                  </div>
                )}

                {/* Step 6: Success */}
                {stkStatus === 'success' && successMsg && (
                  <div style={{ textAlign: 'center', maxWidth: '360px', padding: '20px' }}>
                    <div style={{ 
                      width: '64px', 
                      height: '64px', 
                      background: 'rgba(16, 185, 129, 0.2)', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      margin: '0 auto 20px',
                      border: '2px solid #10b981'
                    }}>
                      <CheckCircle size={36} color="#10b981" />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Transaction Approved</h3>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', marginBottom: '24px' }}>
                      {successMsg}
                    </p>
                    <button 
                      className="btn" 
                      style={{ background: '#ffffff', color: '#000000', padding: '10px 24px', fontWeight: 600 }}
                      onClick={onBack}
                    >
                      Return to Investments
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Right Side: Hazina Hub Companion Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Fund Details Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="var(--primary)" /> Gateway Asset Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asset Class:</span>
                <span style={{ fontWeight: 600 }}>{fund.assetClass === 'MMF' ? 'Money Market Fund' : fund.assetClass === 'SACCO' ? 'SACCO Shares & Deposits' : fund.assetClass === 'T-Bill' ? 'Treasury Bill (T-Bill)' : 'NSE Blue-Chip Stock'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asset Provider:</span>
                <span style={{ fontWeight: 600 }}>{fund.provider}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{fund.assetClass === 'Stock' ? 'Dividend Yield:' : fund.assetClass === 'SACCO' ? 'Dividend yield:' : 'Yield Interest:'}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{fund.interestRate}% p.a.</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Min. Investment:</span>
                <span style={{ fontWeight: 600 }}>{formatKES(fund.minimumInvestment)}</span>
              </div>
            </div>
          </div>

          {/* Checkout Steps Assistance */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Official Payment Channels</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                {fund.assetClass === 'MMF' && (
                  <>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Smartphone size={14} color="var(--primary)" /> Option 1: Dial USSD Code
                    </div>
                    <div>
                      Dial <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{getUSSDCode()}</strong> on your Safaricom mobile and follow prompts to deposit.
                    </div>
                  </>
                )}
                {fund.assetClass === 'SACCO' && (
                  <>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Smartphone size={14} color="var(--primary)" /> Option 1: Pay via paybill or USSD
                    </div>
                    <div>
                      Dial <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{getUSSDCode()}</strong> on your mobile to pay via co-operative mobile banking or use Paybill.
                    </div>
                  </>
                )}
                {fund.assetClass === 'T-Bill' && (
                  <>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Smartphone size={14} color="var(--primary)" /> Option 1: DhowCSD USSD Portal
                    </div>
                    <div>
                      Dial <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{getUSSDCode()}</strong> on your phone to interact with CBK DhowCSD.
                    </div>
                  </>
                )}
                {fund.assetClass === 'Stock' && (
                  <>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Smartphone size={14} color="var(--primary)" /> Option 1: Broker App / USSD
                    </div>
                    <div>
                      Dial your CDSC stockbroker's USSD <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{getUSSDCode()}</strong> or open your broker app to purchase shares.
                    </div>
                  </>
                )}
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Globe size={14} color="var(--secondary)" /> Option 2: Live Website Portal
                </div>
                <div>
                  Toggle the official website tab on top or open the link externally:
                  {fund.websiteUrl && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '8px', display: 'flex', gap: '4px' }}
                      onClick={() => window.open(fund.websiteUrl, '_blank')}
                    >
                      Open Official Portal <ExternalLink size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Manual Sync Form */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={16} color="var(--success)" /> Manual Checkout Sync
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px', lineHeight: '1.4' }}>
              If you have already processed the transaction externally (via USSD or official site), enter the details below to synchronize your Hazina tracker:
            </p>

            {successMsg && stkStatus !== 'success' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleManualSync}>
              <div className="form-group" style={{ gap: '4px' }}>
                <label className="form-label" htmlFor="syncAmount" style={{ fontSize: '0.75rem' }}>Amount Deposited (KES)</label>
                <input 
                  type="number" 
                  id="syncAmount"
                  className="input-control" 
                  min={fund.minimumInvestment}
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                disabled={loading || stkStatus === 'success'}
              >
                {loading ? 'Synchronizing...' : 'Confirm & Sync Portfolio'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Portal;
