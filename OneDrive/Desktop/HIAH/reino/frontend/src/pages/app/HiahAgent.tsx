import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { useSpeech } from '@/hooks/useSpeech'
import { hiahAPI, callsAPI, messagesAPI } from '@/services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { HiahChatMessage, HiahActionRef } from '@/types'

// ── Hiah animated orb ─────────────────────────────────────────
function HiahOrb({ mode }: { mode: string }) {
  return (
    <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
      <div className={clsx('absolute inset-0 rounded-full border border-r-accent/20', mode !== 'idle' && 'animate-pulse-ring')} />
      <div className="absolute inset-2 rounded-full border border-r-teal/10 animate-pulse-ring" style={{ animationDelay: '0.4s' }} />
      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center shadow-lg">
        {mode === 'listening' && (
          <div className="flex gap-0.5 items-end h-5 px-1">
            {[0, 0.1, 0.2, 0.3, 0.2, 0.1].map((d, i) => (
              <div key={i} className="wave-bar flex-1" style={{ animationDelay: `${d}s`, height: '100%' }} />
            ))}
          </div>
        )}
        {mode === 'thinking' && (
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((d, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        )}
        {mode === 'speaking' && (
          <div className="flex gap-0.5 items-end h-5 px-1">
            {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
              <div key={i} className="wave-bar flex-1" style={{ animationDelay: `${d}s`, height: '100%' }} />
            ))}
          </div>
        )}
        {mode === 'idle' && <span className="font-display font-bold text-white text-xl sm:text-2xl">H</span>}
      </div>
      <p className="absolute -bottom-5 text-xs text-r-muted whitespace-nowrap capitalize font-medium">
        {mode === 'idle' ? 'Ready' : mode === 'listening' ? 'Listening…' : mode === 'thinking' ? 'Thinking…' : 'Speaking…'}
      </p>
    </div>
  )
}

// ── Action approval card ──────────────────────────────────────
function ActionCard({ action, onApprove, onReject }: {
  action: HiahActionRef
  onApprove: () => void
  onReject: () => void
}) {
  const icons: Record<string, string> = {
    make_call: '📞', send_sms: '💬', read_messages: '📨',
    read_calls: '📋', read_notifications: '🔔', search_contact: '◈',
    flag_spam: '🚫'
  }
  const statusColors: Record<string, string> = {
    pending: 'text-r-amber', approved: 'text-r-teal', done: 'text-r-teal',
    failed: 'text-red-400', rejected: 'text-r-muted', executing: 'text-blue-400'
  }

  return (
    <div className="mt-2 bg-r-bg/60 rounded-xl border border-r-border/50 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-r-accent">
          <span>{icons[action.type] ?? '⚡'}</span>
          <span className="capitalize">{action.type.replace(/_/g, ' ')}</span>
        </span>
        <span className={clsx('text-xs font-medium capitalize', statusColors[action.status] ?? 'text-r-muted')}>
          {action.status}
        </span>
      </div>
      {action.payload && Object.keys(action.payload).length > 0 && (
        <div className="text-xs text-r-muted font-mono bg-r-bg/40 rounded-lg p-2 mb-2 break-all">
          {JSON.stringify(action.payload)}
        </div>
      )}
      {action.requires_approval && action.status === 'pending' && (
        <div className="flex gap-2">
          <button onClick={onApprove}
            className="flex-1 text-xs bg-r-teal/10 hover:bg-r-teal/20 text-r-teal border border-r-teal/30 rounded-lg py-1.5 font-medium transition-colors">
            ✓ Approve
          </button>
          <button onClick={onReject}
            className="flex-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-1.5 font-medium transition-colors">
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  )
}

// ── Message bubble with edit/copy ────────────────────────────
function Bubble({ msg, onApprove, onReject, onEdit, onCopy }: {
  msg: HiahChatMessage
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onEdit: (msg: HiahChatMessage) => void
  onCopy: (content: string) => void
}) {
  const isHiah  = msg.role === 'hiah'
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className={clsx('flex gap-2 sm:gap-3 group animate-fade-up', isHiah ? 'justify-start' : 'justify-end')}>
      {isHiah && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
          H
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[78%]">
        <div className={clsx(
          'rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed relative',
          isHiah ? 'bg-r-card border border-r-border/50 text-r-text rounded-tl-sm' : 'bg-r-accent text-white rounded-tr-sm'
        )}>
          <p className="whitespace-pre-wrap">{msg.content}</p>
          {msg.action && (
            <ActionCard
              action={msg.action}
              onApprove={() => msg.action?.id && onApprove(msg.action.id)}
              onReject={() => msg.action?.id && onReject(msg.action.id)}
            />
          )}
          <p className={clsx('text-xs mt-1', isHiah ? 'text-r-muted' : 'text-white/60')}>
            {format(new Date(msg.timestamp), 'HH:mm')}
          </p>
        </div>

        {/* Context menu (copy / edit) */}
        <div className={clsx(
          'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isHiah ? 'justify-start' : 'justify-end'
        )}>
          <button onClick={() => onCopy(msg.content)}
            className="text-xs text-r-muted hover:text-r-text bg-r-surface hover:bg-r-card border border-r-border/30 rounded-lg px-2 py-0.5 transition-all">
            Copy
          </button>
          {!isHiah && (
            <button onClick={() => onEdit(msg)}
              className="text-xs text-r-muted hover:text-r-accent bg-r-surface hover:bg-r-card border border-r-border/30 rounded-lg px-2 py-0.5 transition-all">
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Histories sidebar ─────────────────────────────────────────
function HistoriesSidebar({ onSelect, onNew, onClose }: {
  onSelect: (id: string, title: string) => void
  onNew: () => void
  onClose: () => void
}) {
  const [histories, setHistories] = useState<Array<{ id: string; title: string; message_count: number; updated_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hiahAPI.listHistories().then(({ data }) => {
      setHistories(data.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await hiahAPI.deleteHistory(id)
    setHistories(h => h.filter(x => x.id !== id))
  }

  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <div className="w-72 bg-r-surface border-r border-r-border/50 h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-r-border/40">
          <h3 className="font-display font-semibold text-white">Chat Histories</h3>
          <button onClick={onClose} className="text-r-muted hover:text-white text-xl">×</button>
        </div>
        <button onClick={onNew}
          className="mx-4 mt-3 mb-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2">
          + New Chat
        </button>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {loading && <p className="text-r-muted text-sm text-center py-4">Loading…</p>}
          {!loading && histories.length === 0 && (
            <p className="text-r-muted text-sm text-center py-4">No saved chats yet</p>
          )}
          {histories.map(h => (
            <div key={h.id}
              onClick={() => onSelect(h.id, h.title)}
              className="flex items-center gap-2 p-3 rounded-xl hover:bg-r-card cursor-pointer transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-r-text truncate">{h.title}</p>
                <p className="text-xs text-r-muted">{h.message_count} messages · {format(new Date(h.updated_at), 'MMM d')}</p>
              </div>
              <button onClick={(e) => handleDelete(h.id, e)}
                className="opacity-0 group-hover:opacity-100 text-r-muted hover:text-red-400 text-xs transition-all px-1">
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'Call Mama', 'Read my messages', 'Any missed calls?',
  'Send SMS to John: Running late', 'My notifications',
  'Any spam calls?', 'My SIM cards', 'What can you do?',
]

export default function HiahAgent() {
  const { hiahChat, addHiahMessage, clearHiahChat, hiahMode, setHiahMode,
          user, messages, calls, notifications } = useStore()
  const navigate   = useNavigate()
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [editingMsg, setEditingMsg] = useState<HiahChatMessage | null>(null)
  const [showHistories, setShowHistories] = useState(false)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [activeHistoryTitle, setActiveHistoryTitle] = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking } = useSpeech({
    onTranscript: (text) => { setInput(''); sendMessage(text) },
  })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [hiahChat])
  useEffect(() => {
    if (isListening)      setHiahMode('listening')
    else if (isSpeaking)  setHiahMode('speaking')
    else if (!loading)    setHiahMode('idle')
  }, [isListening, isSpeaking, loading, setHiahMode])

  const executeAction = useCallback(async (action: HiahActionRef) => {
    const sims   = user?.sim_cards ?? []
    const defSim = sims.find(s => s.is_default) ?? sims[0]
    const slot   = (action.payload?.sim_slot as number) ?? defSim?.slot ?? 0
    const isp    = defSim?.isp ?? user?.settings.default_isp ?? 'safaricom'

    if (action.type === 'make_call') {
      const phone = action.payload?.phone as string
      if (!phone) { toast.error('No phone number'); return }
      try {
        await callsAPI.initiate({ phone, sim_slot: slot, isp, by_hiah: true })
        window.location.href = `tel:${phone}`
        toast.success('Calling…')
      } catch { toast.error('Could not initiate call') }
    }
    if (action.type === 'send_sms') {
      const phone = action.payload?.phone as string
      const body  = action.payload?.body as string
      if (!phone || !body) { toast.error('Missing phone or message'); return }
      try {
        await messagesAPI.send({ to: phone, body, sim_slot: slot, isp, by_hiah: true })
        toast.success('SMS sent via Hiah!')
      } catch { toast.error('Could not send SMS') }
    }
    if (action.type === 'read_messages') {
      const unread = messages.filter(m => !m.is_read && !m.is_deleted).slice(0, 5)
      if (!unread.length) { toast('No unread messages', { icon: '✅' }); return }
      speak(unread.map((m, i) => `${i+1}. From ${m.contact_name}: ${m.body}`).join('. '))
    }
    if (action.type === 'read_calls') {
      const missed = calls.filter(c => c.status === 'missed').slice(0, 3)
      if (!missed.length) { toast('No missed calls', { icon: '✅' }); return }
      speak(missed.map((c, i) => `${i+1}. Missed call from ${c.contact_name}`).join('. '))
    }
    if (action.type === 'read_notifications') {
      const unread = notifications.filter(n => !n.is_read).slice(0, 5)
      if (!unread.length) { toast('No notifications', { icon: '✅' }); return }
      speak(unread.map((n, i) => `${i+1}. ${n.title}: ${n.body}`).join('. '))
    }
    if (action.type === 'flag_spam') {
      toast('Number flagged as spam')
    }
  }, [user, messages, calls, notifications, speak])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setEditingMsg(null)

    const userMsg: HiahChatMessage = {
      id: `u-${Date.now()}`, role: 'user', type: 'text',
      content: msg, timestamp: new Date().toISOString(),
    }
    addHiahMessage(userMsg)
    setLoading(true)
    setHiahMode('thinking')

    try {
      const { data } = await hiahAPI.chat(msg, hiahChat.slice(-16), activeHistoryId ?? undefined)
      const hiahMsg: HiahChatMessage = data.data
      addHiahMessage(hiahMsg)
      speak(hiahMsg.content)
      if (hiahMsg.action && !hiahMsg.action.requires_approval && hiahMsg.action.status === 'approved') {
        await executeAction(hiahMsg.action)
      }
    } catch {
      addHiahMessage({
        id: `h-${Date.now()}`, role: 'hiah', type: 'text',
        content: "I'm having trouble connecting. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
      setHiahMode('idle')
    }
  }, [input, hiahChat, loading, executeAction, speak, addHiahMessage, setHiahMode, activeHistoryId])

  const handleApprove = async (actionId: string) => {
    try {
      const { data } = await hiahAPI.approveAction(actionId)
      toast.success('Approved!')
      const msg = hiahChat.find(m => m.action?.id === actionId)
      if (msg?.action) await executeAction({ ...msg.action, status: 'approved' })
    } catch { toast.error('Could not approve') }
  }

  const handleReject = async (actionId: string) => {
    try { await hiahAPI.rejectAction(actionId); toast('Cancelled', { icon: '🚫' }) }
    catch { toast.error('Could not reject') }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(() => toast('Copied!'))
  }

  const handleEdit = (msg: HiahChatMessage) => {
    setEditingMsg(msg)
    setInput(msg.content)
    inputRef.current?.focus()
  }

  const handleNewHistory = async () => {
    try {
      const { data } = await hiahAPI.createHistory()
      setActiveHistoryId(data.data.id)
      setActiveHistoryTitle(data.data.title)
      clearHiahChat()
      setShowHistories(false)
      toast('New chat started')
    } catch { toast.error('Failed to create chat') }
  }

  const handleSelectHistory = async (id: string, title: string) => {
    try {
      const { data } = await hiahAPI.getHistory(id)
      // Load history messages into chat
      clearHiahChat()
      setActiveHistoryId(id)
      setActiveHistoryTitle(title)
      setShowHistories(false)
      toast(`Loaded: ${title}`)
    } catch { toast.error('Failed to load history') }
  }

  const perms = user?.settings.hiah_permissions
  const permBadges = [
    { label: 'Calls', on: perms?.can_make_calls },
    { label: 'SMS',   on: perms?.can_send_sms },
    { label: 'Read',  on: perms?.can_read_messages },
    { label: 'Spam',  on: perms?.detect_spam },
  ]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-r-surface/60 border-b border-r-border/40 px-3 sm:px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-5">
          <HiahOrb mode={hiahMode} />
          <div className="flex-1 ml-3 sm:ml-5 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-white text-base sm:text-xl">Hiah</h2>
              {activeHistoryTitle && (
                <span className="text-xs text-r-muted bg-r-card border border-r-border px-2 py-0.5 rounded-full truncate max-w-32">
                  {activeHistoryTitle}
                </span>
              )}
            </div>
            <p className="text-r-muted text-xs">AI Communications Agent</p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {permBadges.map(p => (
                <span key={p.label} className={clsx('text-xs px-1.5 py-0.5 rounded-full border font-medium',
                  p.on ? 'bg-r-teal/10 text-r-teal border-r-teal/20' : 'bg-r-border/20 text-r-muted border-r-border/30')}>
                  {p.label} {p.on ? '✓' : '✗'}
                </span>
              ))}
              <button onClick={() => navigate('/app/settings')} className="text-xs text-r-accent px-1">Edit →</button>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setShowHistories(true)}
              className="btn-ghost text-xs py-1.5 px-2 sm:px-3 flex items-center gap-1" title="Chat histories">
              <span className="hidden sm:inline">History</span>
              <span>📋</span>
            </button>
            <button onClick={() => { clearHiahChat(); setActiveHistoryId(null); setActiveHistoryTitle(null) }}
              className="btn-ghost text-xs py-1.5 px-2">
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {hiahChat.map(msg => (
            <Bubble key={msg.id} msg={msg}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              onCopy={handleCopy}
            />
          ))}
          {loading && (
            <div className="flex gap-3 animate-fade-up">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">H</div>
              <div className="bg-r-card border border-r-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-r-accent animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions */}
      {hiahChat.length <= 1 && (
        <div className="flex-shrink-0 px-3 sm:px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-r-muted mb-2">Try:</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs bg-r-card border border-r-border/50 hover:border-r-accent/40 text-r-muted hover:text-r-text px-2.5 sm:px-3 py-1.5 rounded-full transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-r-border/40 bg-r-surface/60">
        {editingMsg && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 bg-r-accent/10 border border-r-accent/20 rounded-xl px-3 py-2">
            <span className="text-xs text-r-accent flex-1 truncate">Editing: {editingMsg.content.slice(0, 50)}…</span>
            <button onClick={() => { setEditingMsg(null); setInput('') }} className="text-r-muted hover:text-white text-sm">×</button>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex gap-2 sm:gap-3">
          <button onClick={isListening ? stopListening : isSpeaking ? stopSpeaking : startListening}
            className={clsx(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all text-lg',
              isListening ? 'bg-r-pink/20 border border-r-pink/50 text-r-pink animate-pulse' :
              isSpeaking  ? 'bg-r-teal/20 border border-r-teal/50 text-r-teal' :
              'bg-r-card border border-r-border hover:border-r-accent/40 text-r-muted hover:text-r-accent'
            )}>
            {isListening ? '⏹' : '🎙'}
          </button>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={editingMsg ? 'Edit your message…' : 'Tell Hiah what to do…'}
            className="input-field flex-1 text-sm"
            disabled={loading || isListening}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="btn-primary w-10 h-10 sm:w-11 sm:h-11 rounded-xl p-0 flex items-center justify-center flex-shrink-0 text-lg">
            →
          </button>
        </div>
        <p className="text-xs text-r-muted text-center mt-1.5 hidden sm:block">
          Hiah acts on your behalf · Settings → Hiah Permissions to control access
        </p>
      </div>

      {/* Histories panel */}
      {showHistories && (
        <HistoriesSidebar
          onSelect={handleSelectHistory}
          onNew={handleNewHistory}
          onClose={() => setShowHistories(false)}
        />
      )}
    </div>
  )
}
