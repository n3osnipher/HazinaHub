import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import type { ApiResponse } from '@hazinahub/types';
import { Send, BrainCircuit, Sparkles, AlertTriangle, Plus, Clipboard, Check, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'ai' | 'user';
  timestamp: Date;
}

interface Thread {
  threadId: string;
  title: string;
  lastMessageAt?: string;
}

interface ChatProps {
  onNavigate?: (tab: string) => void;
}

const Chat: React.FC<ChatProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I am Hazina AI, your context-aware financial advisor. I read your real-time business wallet transaction history, expenses, and MMF investments to give you tailored, actionable advice. How can I help you grow your business and optimize your portfolio today?",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Threads & Active Session State
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('default');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Copy / Edit inline actions state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = async () => {
    try {
      const response = await api.get<ApiResponse<Thread[]>>('/ai/threads');
      if (response.data.success && response.data.data) {
        setThreads(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  };

  const fetchHistory = async (threadId: string) => {
    try {
      const response = await api.get<ApiResponse<Array<{ id: string; sender: 'ai' | 'user'; text: string; createdAt: string }>>>(
        `/ai/chat?thread_id=${threadId}`
      );
      if (response.data.success && response.data.data) {
        const loadedMessages = response.data.data.map((m) => ({
          id: m.id,
          text: m.text,
          sender: m.sender,
          timestamp: new Date(m.createdAt)
        }));
        
        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
        } else {
          // Fallback welcome message
          setMessages([
            {
              id: 'welcome',
              text: "Hello! I am Hazina AI, your context-aware financial advisor. I read your real-time business wallet transaction history, expenses, and MMF investments to give you tailored, actionable advice. How can I help you grow your business and optimize your portfolio today?",
              sender: 'ai',
              timestamp: new Date()
            }
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    fetchHistory(activeThreadId);
    setEditingMessageId(null);
  }, [activeThreadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleNewChat = () => {
    const newThreadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setActiveThreadId(newThreadId);
    setMessages([
      {
        id: 'welcome',
        text: "Hello! I am Hazina AI, your context-aware financial advisor. I read your real-time business wallet transaction history, expenses, and MMF investments to give you tailored, actionable advice. How can I help you grow your business and optimize your portfolio today?",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: textToSend,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<{ reply: string }>>('/ai/chat', {
        message: textToSend,
        thread_id: activeThreadId,
        user_local_time: new Date().toString()
      });

      if (response.data.success && response.data.data) {
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          text: response.data.data.reply,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, aiMessage]);
        fetchThreads(); // Refresh thread list to show new/renamed thread
      } else {
        setError(response.data.error || 'Gemini advisor is temporarily unavailable');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleStartEdit = (id: string, text: string) => {
    setEditingMessageId(id);
    setEditingText(text);
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editingText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<ApiResponse<Array<{ id: string; sender: 'ai' | 'user'; text: string; createdAt: string }>>>(
        '/ai/chat/edit',
        {
          message_id: msgId,
          text: editingText,
          thread_id: activeThreadId,
          user_local_time: new Date().toString()
        }
      );
      if (response.data.success && response.data.data) {
        const loadedMessages = response.data.data.map((m) => ({
          id: m.id,
          text: m.text,
          sender: m.sender,
          timestamp: new Date(m.createdAt)
        }));
        setMessages(loadedMessages);
        setEditingMessageId(null);
        fetchThreads(); // Refresh the thread list titles
      } else {
        setError(response.data.error || 'Failed to update prompt and regenerate response');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Edit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const renderMessageText = (text: string) => {
    const tabLinkRegex = /\[([^\]]+)\]\(tab:([a-z]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = tabLinkRegex.exec(text)) !== null) {
      const [, label, tabName] = match;
      const matchIndex = match.index;
      
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      
      parts.push(
        <button
          key={matchIndex}
          onClick={() => {
            if (onNavigate) {
              onNavigate(tabName);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
            font: 'inherit',
            fontWeight: 600,
            display: 'inline'
          }}
        >
          {label}
        </button>
      );
      
      lastIndex = tabLinkRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Hazina AI Advisor</h1>
          <p style={{ color: 'var(--text-muted)' }}>Your personalized financial advisor for cash flow insights and investment recommendations.</p>
        </div>
      </div>

      <div className="glass-panel chat-container-layout" style={{ 
        display: 'flex', 
        height: 'calc(100vh - 170px)', 
        maxWidth: '1100px', 
        margin: '0 auto',
        overflow: 'hidden',
        borderRadius: 'var(--card-radius)'
      }}>
        {/* Left column: Sidebar for history */}
        <div className="chat-history-sidebar" style={{ 
          width: '260px', 
          borderRight: '1px solid var(--border-glass)', 
          display: sidebarOpen ? 'flex' : 'none', 
          flexDirection: 'column', 
          background: 'var(--bg-sidebar)',
          flexShrink: 0
        }}>
          {/* New Chat Button */}
          <button 
            className="btn btn-primary" 
            style={{ margin: '16px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
            onClick={handleNewChat}
          >
            <Plus size={16} /> New Chat
          </button>
          
          {/* Thread List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
              Conversations
            </div>
            
            {threads.length === 0 ? (
              <div style={{ padding: '12px 8px', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No past conversations.
              </div>
            ) : (
              threads.map((t) => (
                <button 
                  key={t.threadId}
                  className={`btn nav-item ${activeThreadId === t.threadId ? 'active' : ''}`}
                  style={{ 
                    justifyContent: 'flex-start', 
                    padding: '10px 14px', 
                    width: '100%', 
                    fontSize: '0.875rem',
                    background: activeThreadId === t.threadId ? 'var(--primary-glow)' : 'transparent',
                    color: activeThreadId === t.threadId ? 'var(--primary)' : 'var(--text-muted)',
                    border: 'none',
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}
                  onClick={() => setActiveThreadId(t.threadId)}
                >
                  {t.title}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right column: Active Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', background: 'var(--bg-surface)', minWidth: 0 }}>
          {/* Chat Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            paddingBottom: '16px', 
            borderBottom: '1px solid var(--border-glass)',
            marginBottom: '8px'
          }}>
            <button 
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'var(--primary-glow)'
              }}
              title={sidebarOpen ? "Hide History Sidebar" : "Show History Sidebar"}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <div style={{
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BrainCircuit size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Hazina Agent
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online & analyzing your business metrics</div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isEditing = msg.id === editingMessageId;
              
              if (isEditing) {
                return (
                  <div key={msg.id} className="chat-bubble user" style={{ 
                    alignSelf: 'flex-end', 
                    width: '100%', 
                    maxWidth: '80%',
                    padding: '16px',
                    borderRadius: '16px',
                    borderBottomRightRadius: '4px',
                    background: 'var(--primary-glow)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: 'var(--text-main)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginBottom: '8px', fontWeight: 600 }}>
                      EDITING PROMPT
                    </div>
                    <textarea
                      className="input-control"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', marginBottom: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', padding: '10px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        type="button"
                        className="btn btn-glass" 
                        style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        onClick={() => setEditingMessageId(null)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        onClick={() => handleSaveEdit(msg.id)}
                        disabled={loading || !editingText.trim()}
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`chat-bubble ${msg.sender}`} style={{ 
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                  maxWidth: '80%',
                  padding: '16px',
                  borderRadius: '16px',
                  borderBottomRightRadius: isUser ? '4px' : '16px',
                  borderBottomLeftRadius: isUser ? '16px' : '4px',
                  background: isUser ? 'var(--primary-glow)' : 'rgba(0,0,0,0.02)',
                  border: isUser ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-glass)',
                  color: 'var(--text-main)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                      {isUser ? 'YOU' : 'HAZINA ADVISOR'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem' }}
                        onClick={() => handleCopy(msg.id, msg.text)}
                        title="Copy text"
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Clipboard size={12} />}
                        {copiedId === msg.id ? 'Copied!' : 'Copy'}
                      </button>
                      {isUser && msg.id !== 'welcome' && (
                        <button 
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem' }}
                          onClick={() => handleStartEdit(msg.id, msg.text)}
                          title="Edit message"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
                    {renderMessageText(msg.text)}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="chat-bubble ai" style={{ alignSelf: 'flex-start', maxWidth: '80%', padding: '16px', borderRadius: '16px', borderBottomLeftRadius: '4px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginBottom: '6px', fontWeight: 600 }}>
                  HAZINA ADVISOR
                </div>
                <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                  <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} />
                  <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} />
                </div>
              </div>
            )}

            {error && (
              <div style={{ 
                alignSelf: 'center',
                background: 'var(--danger-glow)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                color: 'var(--danger)', 
                padding: '12px 16px', 
                borderRadius: '10px', 
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '90%'
              }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Row */}
          {messages.length === 1 && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Inquiries</div>
                <button 
                  type="button"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  {showSuggestions ? "Hide" : "Show"}
                </button>
              </div>
              {showSuggestions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button 
                    type="button"
                    className="btn btn-glass" 
                    style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                    onClick={() => handleQuickPrompt("Analyze my business transactions and tell me my financial health score.")}
                  >
                    <Sparkles size={12} color="var(--primary)" /> Analyze financial health score
                  </button>
                  <button 
                    type="button"
                    className="btn btn-glass" 
                    style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                    onClick={() => handleQuickPrompt("Based on my business cashflow, how much money can I afford to invest this month?")}
                  >
                    <Sparkles size={12} color="var(--primary)" /> How much can I invest?
                  </button>
                  <button 
                    type="button"
                    className="btn btn-glass" 
                    style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                    onClick={() => handleQuickPrompt("Explain the 50/30/20 saving rule and how it applies to a developer/founder.")}
                  >
                    <Sparkles size={12} color="var(--primary)" /> 50/30/20 rule for founders
                  </button>
                  <button 
                    type="button"
                    className="btn btn-glass" 
                    style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                    onClick={() => handleQuickPrompt("What is the difference between investing in an MMF, a SACCO, and CBK Treasury Bills in Kenya?")}
                  >
                    <Sparkles size={12} color="var(--primary)" /> MMF vs SACCO vs T-Bills
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="chat-input-area">
            <input
              type="text"
              className="input-control"
              placeholder="Ask Hazina AI about your business cashflow or investments..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !input.trim()}
              style={{ width: '48px', height: '48px', padding: 0, flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
};

export default Chat;
