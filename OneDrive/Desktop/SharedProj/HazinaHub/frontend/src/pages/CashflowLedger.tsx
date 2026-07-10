import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import api, { getOfflineQueueLength, processOfflineQueue } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Cashflow, ApiResponse, PaginatedResponse } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, AlertCircle, CheckCircle, Mic, UploadCloud, FileText, WifiOff } from 'lucide-react';

const CashflowLedger: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  
  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Deposit Form State
  const [depPhone, setDepPhone] = useState(user?.phone || '');
  const [depAmount, setDepAmount] = useState('');
  const [depCategory, setDepCategory] = useState('income');
  const [depLoading, setDepLoading] = useState(false);
  const [depSuccess, setDepSuccess] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);

  // Withdraw Form State
  const [witPhone, setWitPhone] = useState(user?.phone || '');
  const [witAmount, setWitAmount] = useState('');
  const [witCategory, setWitCategory] = useState('other');
  const [witLoading, setWitLoading] = useState(false);
  const [witSuccess, setWitSuccess] = useState<string | null>(null);
  const [witError, setWitError] = useState<string | null>(null);

  // Ledger State
  const [transactions, setTransactions] = useState<Cashflow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');
  const [voiceAction, setVoiceAction] = useState<{ type: 'deposit' | 'withdraw'; amount: number; phone: string; category?: string } | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [receiptScanLoading, setReceiptScanLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<number | null>(null);
  const [receiptPhone, setReceiptPhone] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  // Smart Capture Tab State
  const [smartTab, setSmartTab] = useState<'voice' | 'statement' | 'gmail'>('voice');
  
  // Statement Sync State
  const [pasteText, setPasteText] = useState('');
  const [statementCandidates, setStatementCandidates] = useState<any[]>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  
  // Gmail Sync State
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailSuccess, setGmailSuccess] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const typeQuery = filterType ? `&type=${filterType}` : '';
      const statusQuery = filterStatus ? `&status=${filterStatus}` : '';
      const response = await api.get<PaginatedResponse<Cashflow>>(
        `/cashflows?page=${page}&limit=10${typeQuery}${statusQuery}`
      );
      if (response.data.success && response.data.data) {
        setTransactions(response.data.data);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages);
        }
      } else {
        setLedgerError(response.data.error || 'Failed to load cashflow ledger');
      }
    } catch (err: any) {
      setLedgerError(err.response?.data?.error || err.message || 'Error fetching cashflows');
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchGmailStatus = async () => {
    try {
      const response = await api.get('/gmail/status');
      if (response.data.success) {
        setGmailConnected(response.data.connected);
        setGmailEmail(response.data.email);
      }
    } catch (err) {
      console.warn('Gmail status load error:', err);
    } finally {
      setGmailLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setGmailError(null);
      setGmailSuccess(null);
      const response = await api.get('/gmail/auth-url');
      if (response.data.success && response.data.authUrl) {
        const width = 500;
        const height = 650;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          response.data.authUrl,
          'gmail_oauth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'GMAIL_CONNECTED') {
            setGmailConnected(true);
            setGmailEmail(event.data.email);
            setGmailSuccess('Gmail integrated successfully!');
            window.removeEventListener('message', handleMessage);
            fetchTransactions();
          }
        };
        window.addEventListener('message', handleMessage);
      } else {
        setGmailError(response.data.error || 'Failed to initialize Gmail integration.');
      }
    } catch (err: any) {
      setGmailError(err.response?.data?.error || err.message || 'Error connecting Gmail.');
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm('Are you sure you want to disconnect Gmail Sync?')) return;
    try {
      setGmailError(null);
      setGmailSuccess(null);
      const response = await api.delete('/gmail/disconnect');
      if (response.data.success) {
        setGmailConnected(false);
        setGmailEmail(null);
        setGmailSuccess('Gmail integration disconnected.');
      }
    } catch (err: any) {
      setGmailError(err.response?.data?.error || err.message || 'Failed to disconnect Gmail.');
    }
  };

  const handleSyncGmail = async () => {
    setGmailSyncing(true);
    setGmailError(null);
    setGmailSuccess(null);
    try {
      const response = await api.post('/gmail/sync');
      if (response.data.success) {
        setGmailSuccess(response.data.message || 'Gmail sync completed.');
        fetchTransactions();
        refreshProfile();
      } else {
        setGmailError(response.data.error || 'Gmail sync failed.');
      }
    } catch (err: any) {
      setGmailError(err.response?.data?.error || err.message || 'Gmail sync failed.');
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) {
      setParseError('Please paste M-Pesa transaction SMS logs first.');
      return;
    }
    setParseLoading(true);
    setParseError(null);
    setImportSuccess(null);
    try {
      const response = await api.post('/cashflows/parse-text', { text: pasteText });
      if (response.data.success) {
        if (response.data.data.length === 0) {
          setParseError('No valid M-Pesa transaction records found. Make sure to paste complete SMS confirmation logs.');
        } else {
          // Default all non-duplicate candidate items to selected
          const items = response.data.data.map((item: any) => ({ ...item, selected: !item.already_exists }));
          setStatementCandidates(items);
          setPasteText('');
        }
      }
    } catch (err: any) {
      setParseError(err.response?.data?.error || err.message || 'Failed to parse text.');
    } finally {
      setParseLoading(false);
    }
  };

  const handleUploadCSV = async (file: File) => {
    setParseLoading(true);
    setParseError(null);
    setImportSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/cashflows/upload-statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        if (response.data.data.length === 0) {
          setParseError('No valid transaction records detected in this CSV statement.');
        } else {
          // Default all non-duplicate candidate items to selected
          const items = response.data.data.map((item: any) => ({ ...item, selected: !item.already_exists }));
          setStatementCandidates(items);
        }
      }
    } catch (err: any) {
      setParseError(err.response?.data?.error || err.message || 'Failed to upload and parse CSV.');
    } finally {
      setParseLoading(false);
    }
  };

  const handleToggleCandidate = (index: number) => {
    setStatementCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleImportCandidates = async () => {
    const selected = statementCandidates.filter((c) => c.selected && !c.already_exists);
    if (selected.length === 0) {
      setParseError('No new cashflow records selected for import.');
      return;
    }
    setImportLoading(true);
    setParseError(null);
    try {
      const response = await api.post('/cashflows/batch-import', { items: selected });
      if (response.data.success) {
        setImportSuccess(response.data.message || 'Import successful!');
        setStatementCandidates([]);
        fetchTransactions();
        refreshProfile();
      }
    } catch (err: any) {
      setParseError(err.response?.data?.error || err.message || 'Batch import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchGmailStatus();
    setOfflineQueueLength(getOfflineQueueLength());

    const onOnline = async () => {
      await processOfflineQueue();
      setOfflineQueueLength(getOfflineQueueLength());
      fetchTransactions();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [page, filterType, filterStatus]);

  const parseCommand = (text: string) => {
    const normalized = text.toLowerCase();
    const depositPattern = /(?:deposit|add|pay|fund)\s+([0-9,]+(?:\.\d{1,2})?)(?:\s*(?:kes|shs|sh))?(?:\s*(?:to|into|for)\s*(2547\d{8}|\+2547\d{8}|07\d{8}))?/i;
    const withdrawPattern = /(?:withdraw|cash\s*out|send|payout|pay)\s+([0-9,]+(?:\.\d{1,2})?)(?:\s*(?:kes|shs|sh))?(?:\s*(?:to|into|for)\s*(2547\d{8}|\+2547\d{8}|07\d{8}))?/i;

    // Detect category keywords
    let detectedCategory = 'other';
    if (normalized.includes('food') || normalized.includes('grocery') || normalized.includes('groceries') || normalized.includes('eat') || normalized.includes('restaurant') || normalized.includes('lunch') || normalized.includes('dinner')) {
      detectedCategory = 'food';
    } else if (normalized.includes('transport') || normalized.includes('matatu') || normalized.includes('uber') || normalized.includes('bolt') || normalized.includes('fare') || normalized.includes('fuel') || normalized.includes('bus') || normalized.includes('travel')) {
      detectedCategory = 'transport';
    } else if (normalized.includes('rent') || normalized.includes('house') || normalized.includes('airbnb')) {
      detectedCategory = 'rent';
    } else if (normalized.includes('airtime') || normalized.includes('credit') || normalized.includes('bundle') || normalized.includes('bundles') || normalized.includes('safaricom')) {
      detectedCategory = 'airtime';
    } else if (normalized.includes('bill') || normalized.includes('bills') || normalized.includes('token') || normalized.includes('tokens') || normalized.includes('electricity') || normalized.includes('water') || normalized.includes('dstv') || normalized.includes('wifi') || normalized.includes('internet')) {
      detectedCategory = 'bills';
    }

    let match = normalized.match(depositPattern);
    if (match) {
      return {
        type: 'deposit' as const,
        amount: Number(match[1].replace(/,/g, '')),
        phone: match[2] || depPhone || witPhone,
        category: detectedCategory === 'other' ? 'income' : detectedCategory,
      };
    }

    match = normalized.match(withdrawPattern);
    if (match) {
      return {
        type: 'withdraw' as const,
        amount: Number(match[1].replace(/,/g, '')),
        phone: match[2] || witPhone || depPhone,
        category: detectedCategory,
      };
    }

    return null;
  };

  const handleVoiceStart = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice commands are not supported by your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setVoiceResult(transcript);
      setVoiceError(null);
      const parsed = parseCommand(transcript);
      if (!parsed || !parsed.amount || !parsed.phone) {
        setVoiceAction(null);
        setVoiceError('Could not identify a deposit or withdrawal voice command. Try “deposit 1000 to 2547...” or “withdraw 500 to 072...”');
        return;
      }
      setVoiceAction(parsed);
    };

    recognition.onerror = (event: any) => {
      setVoiceError(event.error || 'Voice recognition failed.');
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    setVoiceListening(true);
    setVoiceResult('Listening...');
    setVoiceError(null);
    recognition.start();
  };

  const handleVoiceStop = () => {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  };

  const handleVoiceAction = async () => {
    if (!voiceAction) {
      setVoiceError('No parsed voice command available to execute.');
      return;
    }

    setVoiceLoading(true);
    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const response = await api.post<ApiResponse<any>>(
        voiceAction.type === 'deposit' ? '/cashflows/pay' : '/cashflows/withdraw',
        {
          phone: voiceAction.phone,
          amount: voiceAction.amount,
          category: voiceAction.category || (voiceAction.type === 'deposit' ? 'income' : 'other'),
          description: voiceAction.type === 'deposit' ? 'Voice Inflow Sync' : 'Voice Outflow Sync',
        }
      );

      if (response.data.success) {
        setVoiceSuccess(
          voiceAction.type === 'deposit'
            ? response.data.data?.customerMessage || 'Voice inflow command successfully queued.'
            : response.data.data?.message || 'Voice outflow command successfully initiated.'
        );
        setVoiceAction(null);
        setVoiceResult('');
        setOfflineQueueLength(getOfflineQueueLength());
        setTimeout(() => {
          refreshProfile();
          fetchTransactions();
        }, 4000);
      } else {
        setVoiceError(response.data.error || 'Voice cashflow request failed.');
      }
    } catch (err: any) {
      setVoiceError(err.response?.data?.error || err.message || 'Voice cashflow failed.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const parseReceiptText = (text: string) => {
    const amountMatch = text.match(/(?:total|amount|due|pay)\s*[:\-]?\s*(?:kes|shs|sh)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    const phoneMatch = text.match(/(2547\d{8}|\+2547\d{8}|07\d{8})/);
    return {
      amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null,
      phone: phoneMatch ? phoneMatch[0] : '',
    };
  };

  const handleReceiptUpload = async (file: File) => {
    setReceiptScanLoading(true);
    setReceiptError(null);
    setReceiptText('');
    setReceiptAmount(null);
    setReceiptPhone('');

    try {
      const worker = await createWorker({ logger: () => {} });
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(file);
      const extracted = data.text || '';
      setReceiptText(extracted);
      const parsed = parseReceiptText(extracted);
      if (!parsed.amount) {
        setReceiptError('Unable to detect a payment amount from the receipt image.');
      } else {
        setReceiptAmount(parsed.amount);
        setReceiptPhone(parsed.phone || '');
      }
      await worker.terminate();
    } catch (err: any) {
      setReceiptError(err?.message || 'Receipt scan failed. Please try another image.');
    } finally {
      setReceiptScanLoading(false);
    }
  };

  const useReceiptForDeposit = () => {
    if (receiptAmount) {
      setDepAmount(receiptAmount.toString());
    }
    if (receiptPhone) {
      setDepPhone(receiptPhone);
    }
  };

  const useReceiptForWithdraw = () => {
    if (receiptAmount) {
      setWitAmount(receiptAmount.toString());
    }
    if (receiptPhone) {
      setWitPhone(receiptPhone);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError(null);
    setDepSuccess(null);

    const amountNum = parseFloat(depAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setDepError('Please enter a valid deposit amount');
      return;
    }

    setDepLoading(true);
    try {
      const response = await api.post<ApiResponse<any>>('/cashflows/pay', {
        phone: depPhone,
        amount: amountNum,
        category: depCategory,
        description: depCategory === 'income' ? 'Business Sales Sync' : 'Other Inflow Sync',
      });

      if (response.data.success) {
        setDepSuccess(response.data.data?.customerMessage || 'Cashflow inflow logged successfully.');
        setDepAmount('');
        // Refresh profile and transactions shortly after
        setTimeout(() => {
          refreshProfile();
          fetchTransactions();
        }, 5000);
      } else {
        setDepError(response.data.error || 'Inflow logging failed');
      }
    } catch (err: any) {
      setDepError(err.response?.data?.error || err.message || 'Deposit error occurred');
    } finally {
      setDepLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWitError(null);
    setWitSuccess(null);

    const amountNum = Number(witAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setWitError('Please enter a withdrawal amount greater than zero');
      return;
    }

    setWitLoading(true);
    try {
      const response = await api.post<ApiResponse<any>>('/cashflows/withdraw', {
        phone: witPhone,
        amount: amountNum,
        category: witCategory,
        description: `Logged Outflow (${witCategory})`,
      });

      if (response.data.success) {
        setWitSuccess(response.data.data?.message || `KES ${amountNum.toLocaleString()} successfully cashed out.`);
        setWitAmount('');
        await Promise.all([refreshProfile(), fetchTransactions()]);
      } else {
        setWitError(response.data.error || 'Outflow logging failed');
      }
    } catch (err: any) {
      setWitError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setWitLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Cashflow Ledger</h1>
          <p style={{ color: 'var(--text-muted)' }}>Capture and sync your M-Pesa business transactions to analyze cashflow behavior.</p>
        </div>
      </div>

      <div className="money-transfer-layout">
        {/* Form panel */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          {/* Sub tabs */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '10px', 
            padding: '4px',
            marginBottom: '28px',
            border: '1px solid var(--border-glass)'
          }}>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                borderRadius: '8px',
                background: activeSubTab === 'deposit' ? 'var(--primary-glow)' : 'transparent',
                color: activeSubTab === 'deposit' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '8px 0'
              }}
              onClick={() => setActiveSubTab('deposit')}
            >
              <ArrowDownLeft size={16} /> Log Inflow
            </button>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                borderRadius: '8px',
                background: activeSubTab === 'withdraw' ? 'var(--secondary-glow)' : 'transparent',
                color: activeSubTab === 'withdraw' ? 'var(--secondary)' : 'var(--text-muted)',
                padding: '8px 0'
              }}
              onClick={() => setActiveSubTab('withdraw')}
            >
              <ArrowUpRight size={16} /> Log Outflow
            </button>
          </div>

          {activeSubTab === 'deposit' ? (
            /* DEPOSIT FORM */
            <form onSubmit={handleDepositSubmit}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Log Cash Inflow</h3>
              
              {depSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{depSuccess}</span>
                </div>
              )}

              {depError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{depError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="depPhone">Phone Number</label>
                <input
                  type="tel"
                  id="depPhone"
                  className="input-control"
                  placeholder="e.g. 254712345678"
                  value={depPhone}
                  onChange={(e) => setDepPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="depAmount">Inflow Amount (KES)</label>
                <input
                  type="number"
                  id="depAmount"
                  className="input-control"
                  placeholder="e.g. 1000"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="depCategory">Category</label>
                <select
                  id="depCategory"
                  className="input-control"
                  value={depCategory}
                  onChange={(e) => setDepCategory(e.target.value)}
                >
                  <option value="income">Income / Business Sales</option>
                  <option value="other">Other Inflow</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={depLoading}
              >
                {depLoading ? 'Logging Cashflow...' : 'Log Cash Inflow'}
              </button>
            </form>
          ) : (
            /* WITHDRAW FORM */
            <form onSubmit={handleWithdrawSubmit}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Log Cash Outflow</h3>
              
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-glass)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Logged Outflows: </span>
                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>Read-Only Mode</span>
                <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Log external business expenses and payments to calculate accurate monthly net margin and savings capacity.</div>
              </div>

              {witSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{witSuccess}</span>
                </div>
              )}

              {witError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{witError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="witPhone">Phone Number</label>
                <input
                  type="tel"
                  id="witPhone"
                  className="input-control"
                  placeholder="e.g. 254712345678"
                  value={witPhone}
                  onChange={(e) => setWitPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="witAmount">Outflow Amount (KES)</label>
                <input
                  type="number"
                  id="witAmount"
                  className="input-control"
                  placeholder="e.g. 500"
                  min={1}
                  step={1}
                  value={witAmount}
                  onChange={(e) => setWitAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="witCategory">Category</label>
                <select
                  id="witCategory"
                  className="input-control"
                  value={witCategory}
                  onChange={(e) => setWitCategory(e.target.value)}
                >
                  <option value="food">Food & Groceries</option>
                  <option value="transport">Transport / Fuel</option>
                  <option value="rent">Rent / Housing</option>
                  <option value="airtime">Airtime & Data</option>
                  <option value="bills">Bills & Utilities</option>
                  <option value="other">Other Expense</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={witLoading}
              >
                {witLoading ? 'Logging Cashflow...' : 'Log Cash Outflow'}
              </button>
            </form>
          )}
        </div>

        {/* Transaction Ledger Table */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem' }}>My Transactions</h2>
            <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={fetchTransactions}>
              <RefreshCw size={12} /> Sync
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <select 
                className="input-control" 
                style={{ paddingRight: '24px', fontSize: '0.875rem' }}
                value={filterType} 
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="stk_push">Inflows</option>
                <option value="withdrawal">Outflows</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <select 
                className="input-control" 
                style={{ fontSize: '0.875rem' }}
                value={filterStatus} 
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {ledgerLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: '30px', height: '30px', border: '2px solid rgba(16, 185, 129, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : ledgerError ? (
            <div style={{ color: 'var(--danger)', padding: '20px 0', textAlign: 'center', fontSize: '0.875rem' }}>{ledgerError}</div>
          ) : transactions.length === 0 ? (
            <div style={{ color: 'var(--text-dark)', padding: '40px 0', textAlign: 'center' }}>No transactions match search criteria.</div>
          ) : (
            <div>
              <div className="data-table-wrapper" style={{ maxHeight: '380px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref/Receipt</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Phone</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isInflow = tx.type === 'inflow' || tx.type === 'deposit' || tx.type === 'return' || tx.type === 'c2b' || tx.type === 'stk_push';
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                            {tx.receiptNumber ? tx.receiptNumber : tx.id.substring(0, 8)}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>
                              {isInflow ? 'Inflow' : 'Outflow'}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ 
                              fontSize: '0.7rem', 
                              background: 'rgba(0, 0, 0, 0.04)', 
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-glass)',
                              padding: '3px 8px',
                              textTransform: 'capitalize' 
                            }}>
                              {tx.category || (isInflow ? 'income' : 'other')}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx.phone}</td>
                          <td style={{ 
                            fontWeight: 700,
                            color: isInflow ? 'var(--primary)' : 'var(--danger)'
                          }}>
                            {isInflow ? '+' : '-'}{formatKES(tx.amount)}
                          </td>
                        <td>
                          <span className={`badge ${
                            tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-pending' : 'badge-danger'
                          }`} style={{ fontSize: '0.65rem' }}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-glass" 
                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }} 
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                  <button 
                    className="btn btn-glass" 
                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }} 
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '28px', marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Smart Ledger Ingestion</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Automate cashflow logging using voice instructions, statements, or Gmail email sync.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <WifiOff size={16} /> Offline Queue: {offlineQueueLength}
            </span>
          </div>
        </div>

        {/* Smart Ingestion Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px', gap: '20px' }}>
          <button 
            type="button"
            className="btn" 
            style={{ 
              background: 'transparent', 
              color: smartTab === 'voice' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: smartTab === 'voice' ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              padding: '10px 4px',
              fontWeight: 600
            }}
            onClick={() => setSmartTab('voice')}
          >
            Voice & OCR Scan
          </button>
          <button 
            type="button"
            className="btn" 
            style={{ 
              background: 'transparent', 
              color: smartTab === 'statement' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: smartTab === 'statement' ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              padding: '10px 4px',
              fontWeight: 600
            }}
            onClick={() => setSmartTab('statement')}
          >
            Paste SMS / CSV Statement
          </button>
          <button 
            type="button"
            className="btn" 
            style={{ 
              background: 'transparent', 
              color: smartTab === 'gmail' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: smartTab === 'gmail' ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              padding: '10px 4px',
              fontWeight: 600
            }}
            onClick={() => setSmartTab('gmail')}
          >
            Gmail Inbox Sync
          </button>
        </div>

        {/* TAB 1: VOICE & OCR */}
        {smartTab === 'voice' && (
          <div className="smart-capture-layout">
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Voice-to-Ledger</h3>
              {voiceSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
                  {voiceSuccess}
                </div>
              )}
              {voiceError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
                  {voiceError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={voiceListening ? handleVoiceStop : handleVoiceStart}
                >
                  <Mic size={16} /> {voiceListening ? 'Stop Listening' : 'Start Voice Capture'}
                </button>
                <button
                  type="button"
                  className="btn btn-glass"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={handleVoiceAction}
                  disabled={!voiceAction || voiceLoading}
                >
                  <ArrowUpRight size={16} /> Execute
                </button>
              </div>
              <div style={{ color: 'var(--text-muted)', minHeight: '72px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>Detected Voice Command</div>
                <div>{voiceResult || 'Listening will capture a command like “deposit 1000 to 2547...”'}</div>
                {voiceAction && (
                  <div style={{ marginTop: '12px', color: 'var(--text-main)' }}>
                    Parsed action: <strong>{voiceAction.type === 'deposit' ? 'Inflow' : 'Outflow'}</strong> of <strong>{formatKES(voiceAction.amount)}</strong> to <strong>{voiceAction.phone}</strong>{voiceAction.category && (
                      <>
                        {' '}with category <strong style={{ textTransform: 'capitalize' }}>{voiceAction.category}</strong>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Receipt Scan</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <label className="btn btn-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <UploadCloud size={16} /> Upload Receipt
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleReceiptUpload(file);
                      }
                    }}
                  />
                </label>
              </div>
              {receiptScanLoading && (
                <div style={{ color: 'var(--text-muted)', marginBottom: '14px' }}>Scanning receipt... please wait.</div>
              )}
              {receiptError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '14px' }}>
                  {receiptError}
                </div>
              )}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                <FileText size={16} style={{ marginRight: '8px' }} /> Parsed amount and phone are shown below.
              </div>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Amount detected</div>
                  <div style={{ fontWeight: 700, color: receiptAmount ? 'var(--primary)' : 'var(--text-dark)' }}>
                    {receiptAmount ? formatKES(receiptAmount) : 'None yet'}
                  </div>
                </div>
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Phone detected</div>
                  <div style={{ fontWeight: 700, color: receiptPhone ? 'var(--text-main)' : 'var(--text-dark)' }}>
                    {receiptPhone || 'None yet'}
                  </div>
                </div>
              </div>
              {receiptText && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'var(--text-dark)', whiteSpace: 'pre-wrap', fontSize: '0.825rem', marginBottom: '16px' }}>
                  <strong>Extracted Receipt Text</strong>
                  <div style={{ marginTop: '8px' }}>{receiptText}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-primary" onClick={useReceiptForDeposit} disabled={!receiptAmount}>
                  Use for Inflow
                </button>
                <button type="button" className="btn btn-secondary" onClick={useReceiptForWithdraw} disabled={!receiptAmount}>
                  Use for Outflow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PASTE SMS / CSV STATEMENT */}
        {smartTab === 'statement' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '24px' }}>
              {/* Left Column: Input Panel */}
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '24px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Paste M-Pesa SMS Logs</h3>
                <textarea
                  className="input-control"
                  style={{ width: '100%', height: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8125rem', marginBottom: '12px', padding: '12px' }}
                  placeholder="Paste complete M-Pesa SMS lines here... E.g. KQA1234567 Confirmed. You have received Ksh1,500.00 from..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleParseText}
                  disabled={parseLoading}
                >
                  {parseLoading ? 'Parsing Text...' : 'Parse Copy-Pasted Text'}
                </button>

                <div style={{ margin: '20px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

                <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Upload M-Pesa CSV Statement</h3>
                <label className="btn btn-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <UploadCloud size={16} /> Choose CSV Statement
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadCSV(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Right Column: Information & Notes */}
              <div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '12px' }}>How Statement Syncing Works</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                  Hazina Hub implements client-side and server-side pattern recognition algorithms that run entirely inside our secure sandbox ecosystem.
                </p>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '6px' }}>🔑 Privacy & Compliance Note</strong>
                  M-Pesa SMS copy-pasting is fully web-compatible, legal, and does not require security permissions. Statements are parsed directly to identify inflow values, outflows, and dates. Duplicate records containing the same receipt number are automatically excluded.
                </div>
              </div>
            </div>

            {/* Ingestion Preview Table */}
            {parseError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {parseError}
              </div>
            )}
            {importSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {importSuccess}
              </div>
            )}

            {statementCandidates.length > 0 && (
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Parsed Statements Candidates ({statementCandidates.length})</h3>
                <div className="data-table-wrapper" style={{ maxHeight: '240px', marginBottom: '16px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>Sync</th>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementCandidates.map((c, idx) => (
                        <tr key={idx} style={{ opacity: c.already_exists ? 0.4 : 1 }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={c.selected}
                              disabled={c.already_exists}
                              onChange={() => handleToggleCandidate(idx)}
                              style={{ width: '16px', height: '16px', cursor: c.already_exists ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>{formatDate(c.created_at)}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.receipt_number || 'N/A'}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>
                              {c.type === 'inflow' ? 'Inflow' : 'Outflow'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: c.type === 'inflow' ? 'var(--primary)' : 'var(--danger)' }}>
                            {c.type === 'inflow' ? '+' : '-'}{formatKES(c.amount)}
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>{c.description}</td>
                          <td>
                            <span className="badge" style={{ fontSize: '0.65rem' }}>{c.category}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Duplicates with existing database records are locked and skipped automatically.
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={importLoading || statementCandidates.filter(c => c.selected && !c.already_exists).length === 0}
                    onClick={handleImportCandidates}
                  >
                    {importLoading ? 'Importing...' : 'Confirm and Import Selected'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GMAIL INBOX SYNC */}
        {smartTab === 'gmail' && (
          <div style={{ padding: '10px 0' }}>
            {gmailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid rgba(16, 185, 129, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
                {/* Integration control panel */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Google Workspace Ingestion</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '24px' }}>
                    Connect your Gmail to automatically download and synchronize cashflow statements sent by M-Pesa. Hazina AI intercepts new emails, matches records, and logs them in real-time.
                  </p>

                  {gmailError && (
                    <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                      {gmailError}
                    </div>
                  )}

                  {gmailSuccess && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                      {gmailSuccess}
                    </div>
                  )}

                  {!gmailConnected ? (
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 20px' }}
                      onClick={handleConnectGmail}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Link Gmail Account
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Linked to {gmailEmail}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={gmailSyncing}
                          onClick={handleSyncGmail}
                        >
                          {gmailSyncing ? 'Syncing Gmail inbox...' : 'Sync Emails Now'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-glass"
                          style={{ color: 'var(--danger)' }}
                          onClick={handleDisconnectGmail}
                        >
                          Disconnect Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Information panel */}
                <div style={{ paddingLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>OAuth Consent & Scope</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                    By connecting Gmail, you grant Hazina Hub a read-only token to fetch message summaries.
                  </p>
                  <ul style={{ color: 'var(--text-dark)', fontSize: '0.8125rem', margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>Scope: <code>gmail.readonly</code></li>
                    <li>Restricted query: <code>subject:("M-PESA Confirmed")</code></li>
                    <li>No write access, no deletion rights, and no visibility into personal emails.</li>
                    <li>Token storage is encrypted. Disconnecting removes tokens instantly.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default CashflowLedger;
