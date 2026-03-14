/**
 * CustomDialer.tsx
 * Full in-app call UI with dial pad, contact search, active call timer,
 * call state (ringing/ongoing/ended) — no native OS dialer
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { callsAPI, contactsAPI } from '@/services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { Contact, CallRecord } from '@/types'

// ── Call state machine display ────────────────────────────────
const CALL_STATE_LABELS: Record<string, { label: string; color: string }> = {
  ringing:  { label: 'Ringing…',    color: 'text-r-amber' },
  outgoing: { label: 'Dialing…',    color: 'text-r-amber' },
  incoming: { label: 'Incoming…',   color: 'text-r-teal' },
  ongoing:  { label: 'Connected',   color: 'text-r-teal' },
  called:   { label: 'Call ended',  color: 'text-r-muted' },
  ended:    { label: 'Call ended',  color: 'text-r-muted' },
  missed:   { label: 'Missed',      color: 'text-red-400' },
  rejected: { label: 'Rejected',    color: 'text-red-400' },
  failed:   { label: 'Failed',      color: 'text-red-400' },
  voicemail:{ label: 'Voicemail',   color: 'text-r-muted' },
}

// ── Active call screen ────────────────────────────────────────
function ActiveCallScreen({
  call, onEnd, onMute, onKeypad, muted, keypadOpen
}: {
  call: CallRecord
  onEnd: () => void
  onMute: () => void
  onKeypad: () => void
  muted: boolean
  keypadOpen: boolean
}) {
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isLive = call.status === 'ongoing'

  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isLive])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const stateInfo = CALL_STATE_LABELS[call.status] ?? { label: call.status, color: 'text-r-muted' }
  const initials  = call.contact_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-[200] bg-r-bg flex flex-col items-center justify-between p-6 pb-10">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20"
          style={{ background: isLive ? 'radial-gradient(circle, #00d4aa 0%, transparent 70%)' : 'radial-gradient(circle, #6c63ff 0%, transparent 70%)' }} />
      </div>

      {/* Status bar */}
      <div className="relative z-10 w-full flex items-center justify-between">
        <div className={clsx('text-sm font-medium', stateInfo.color)}>{stateInfo.label}</div>
        {call.is_spam && <div className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">⚠️ Spam</div>}
        {call.is_unknown && !call.is_spam && <div className="text-xs bg-r-amber/20 text-r-amber px-2 py-0.5 rounded-full border border-r-amber/30">❓ Unknown</div>}
      </div>

      {/* Contact info */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className={clsx(
          'w-28 h-28 rounded-full flex items-center justify-center font-display font-bold text-3xl text-white',
          isLive ? 'bg-gradient-to-br from-r-teal to-r-accent animate-glow' : 'bg-r-card border border-r-border'
        )}>
          {initials}
        </div>
        <div className="text-center">
          <h2 className="font-display font-bold text-white text-2xl">{call.contact_name}</h2>
          <p className="text-r-muted text-sm mt-1">{call.phone}</p>
          <p className="text-r-muted text-xs mt-0.5">SIM{call.sim_slot + 1} · {call.isp}</p>
        </div>
        {isLive && (
          <div className="font-mono text-r-teal text-2xl font-semibold">{formatTime(seconds)}</div>
        )}
      </div>

      {/* Keypad overlay */}
      {keypadOpen && (
        <div className="relative z-10 w-full max-w-xs bg-r-card rounded-2xl border border-r-border p-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
              <button key={k} className="h-10 rounded-xl bg-r-surface hover:bg-r-border text-white font-semibold transition-colors">
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 w-full max-w-xs">
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="flex flex-col items-center gap-1">
            <button onClick={onMute}
              className={clsx('w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all',
                muted ? 'bg-r-accent/20 text-r-accent border border-r-accent/40' : 'bg-r-card text-r-muted hover:bg-r-border')}>
              {muted ? '🔇' : '🎙'}
            </button>
            <span className="text-xs text-r-muted">{muted ? 'Unmute' : 'Mute'}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button onClick={onKeypad}
              className={clsx('w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all',
                keypadOpen ? 'bg-r-accent/20 text-r-accent border border-r-accent/40' : 'bg-r-card text-r-muted hover:bg-r-border')}>
              ⌨️
            </button>
            <span className="text-xs text-r-muted">Keypad</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button className="w-14 h-14 rounded-full bg-r-card text-r-muted hover:bg-r-border flex items-center justify-center text-xl transition-all">
              📢
            </button>
            <span className="text-xs text-r-muted">Speaker</span>
          </div>
        </div>

        {/* End call button */}
        <div className="flex justify-center">
          <button onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center text-white text-2xl transition-all shadow-lg">
            📵
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Incoming call screen ──────────────────────────────────────
function IncomingCallScreen({
  call, onAnswer, onReject
}: {
  call: CallRecord
  onAnswer: () => void
  onReject: () => void
}) {
  const initials = call.contact_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-[200] bg-r-bg flex flex-col items-center justify-between p-6 pb-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6c63ff 0%, transparent 70%)' }} />
      </div>

      {/* Spam/unknown badge */}
      <div className="relative z-10 w-full flex justify-center mt-8">
        {call.is_spam ? (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
            ⚠️ Likely Spam — be careful
          </div>
        ) : call.is_unknown ? (
          <div className="bg-r-amber/10 border border-r-amber/30 text-r-amber px-4 py-2 rounded-xl text-sm font-medium">
            ❓ Number not in your contacts
          </div>
        ) : null}
      </div>

      {/* Contact */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center font-display font-bold text-3xl text-white animate-pulse-ring">
            {initials}
          </div>
          <div className="absolute -inset-4 rounded-full border border-r-accent/20 animate-pulse-ring" />
          <div className="absolute -inset-8 rounded-full border border-r-accent/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="text-center">
          <p className="text-r-muted text-sm mb-1">Incoming call</p>
          <h2 className="font-display font-bold text-white text-2xl">{call.contact_name}</h2>
          <p className="text-r-muted text-sm mt-1">{call.phone}</p>
          <p className="text-r-muted text-xs">SIM{call.sim_slot + 1} · {call.isp}</p>
        </div>
      </div>

      {/* Answer / Reject */}
      <div className="relative z-10 flex gap-16">
        <div className="flex flex-col items-center gap-2">
          <button onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center text-white text-2xl transition-all shadow-lg">
            📵
          </button>
          <span className="text-xs text-r-muted">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button onClick={onAnswer}
            className="w-16 h-16 rounded-full bg-r-teal hover:bg-r-teal/80 active:scale-95 flex items-center justify-center text-white text-2xl transition-all shadow-lg">
            📞
          </button>
          <span className="text-xs text-r-muted">Answer</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Dialer component ─────────────────────────────────────
interface DialerProps {
  onClose: () => void
}

export default function CustomDialer({ onClose }: DialerProps) {
  const { contacts, user, addCall, updateCall } = useStore()
  const [dialValue, setDialValue]   = useState('')
  const [search, setSearch]         = useState('')
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null)
  const [muted, setMuted]           = useState(false)
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [sims]                      = useState(user?.sim_cards ?? [])
  const [activeSim, setActiveSim]   = useState(sims.find(s => s.is_default)?.slot ?? 0)

  const filteredContacts = search.trim()
    ? contacts.filter(c =>
        !c.is_blocked &&
        (c.name.toLowerCase().includes(search.toLowerCase()) ||
         c.phone.includes(search))
      ).slice(0, 8)
    : []

  const dialPad = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['*','0','#'],
  ]

  const handleDial = async (phone: string, contactName?: string) => {
    const sim = sims.find(s => s.slot === activeSim)
    try {
      const { data } = await callsAPI.initiate({
        phone,
        contact_name: contactName,
        sim_slot: activeSim,
        isp: sim?.isp ?? 'safaricom',
        by_hiah: false,
      })
      const record = data.data as CallRecord
      addCall(record)
      setActiveCall(record)

      // Warn about spam
      if (data.warnings?.is_spam) {
        toast('⚠️ This number is flagged as spam', { icon: '🚫', duration: 4000 })
      } else if (data.warnings?.is_unknown) {
        toast('❓ This number is not in your contacts', { duration: 3000 })
      }

      // Simulate call progression (in production: device reports state via WS)
      setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, status: 'ongoing' } : null)
        updateCall(record.id, { status: 'ongoing' })
      }, 3000)

    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not initiate call'
      toast.error(msg)
    }
  }

  const handleEndCall = async () => {
    if (!activeCall) return
    const ended_at = new Date().toISOString()
    try {
      await callsAPI.update(activeCall.id, { status: 'called', ended_at })
      updateCall(activeCall.id, { status: 'called', ended_at })
    } catch { /* offline ok */ }
    setActiveCall(null)
    setMuted(false)
    setKeypadOpen(false)
    toast('Call ended')
  }

  const handleAnswer = () => {
    if (!incomingCall) return
    setActiveCall({ ...incomingCall, status: 'ongoing' })
    setIncomingCall(null)
  }

  const handleRejectIncoming = async () => {
    if (!incomingCall) return
    await callsAPI.update(incomingCall.id, { status: 'rejected' })
    updateCall(incomingCall.id, { status: 'rejected' })
    setIncomingCall(null)
  }

  // ── Render active/incoming overlays ──────────────────────
  if (incomingCall) {
    return <IncomingCallScreen call={incomingCall} onAnswer={handleAnswer} onReject={handleRejectIncoming} />
  }
  if (activeCall && ['outgoing', 'ringing', 'ongoing'].includes(activeCall.status)) {
    return (
      <ActiveCallScreen
        call={activeCall}
        onEnd={handleEndCall}
        onMute={() => setMuted(m => !m)}
        onKeypad={() => setKeypadOpen(k => !k)}
        muted={muted}
        keypadOpen={keypadOpen}
      />
    )
  }

  // ── Dial pad UI ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-r-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-r-border/40">
        <h2 className="font-display font-bold text-white text-lg">Phone</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-r-card text-r-muted hover:text-white flex items-center justify-center transition-colors text-xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* SIM selector */}
        {sims.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 flex-wrap">
            {sims.map(sim => (
              <button key={sim.slot} onClick={() => setActiveSim(sim.slot)}
                className={clsx('text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                  activeSim === sim.slot
                    ? 'bg-r-accent/20 text-r-accent border-r-accent/40'
                    : 'bg-r-surface text-r-muted border-r-border')}>
                SIM{sim.slot + 1} · {sim.isp ?? '?'}
                {sim.phone_number && ` · ${sim.phone_number}`}
              </button>
            ))}
          </div>
        )}

        {/* Display + search */}
        <div className="px-4 pt-4">
          <input
            value={dialValue || search}
            onChange={e => {
              const v = e.target.value
              setSearch(v)
              setDialValue(v.replace(/\D/g, ''))
            }}
            placeholder="Type number or search contact…"
            className="input-field text-center text-xl font-mono py-4"
          />
        </div>

        {/* Contact suggestions */}
        {filteredContacts.length > 0 && (
          <div className="px-4 mt-3 space-y-1">
            {filteredContacts.map(c => (
              <button key={c.id} onClick={() => handleDial(c.phone, c.name)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-r-card hover:bg-r-border transition-colors text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: c.color }}>
                  {c.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-xs text-r-muted">{c.phone}</p>
                </div>
                <span className="text-r-teal text-lg flex-shrink-0">📞</span>
              </button>
            ))}
          </div>
        )}

        {/* Dial pad */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
          <div className="w-full max-w-xs">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {dialPad.flat().map(key => (
                <button
                  key={key}
                  onClick={() => {
                    setDialValue(v => v + key)
                    setSearch(v => v + key)
                  }}
                  className="h-16 rounded-2xl bg-r-card hover:bg-r-border active:scale-95 text-white font-semibold text-xl transition-all border border-r-border/40">
                  {key}
                </button>
              ))}
            </div>

            {/* Call + backspace row */}
            <div className="flex items-center justify-between gap-4">
              <div className="w-16" />
              <button
                onClick={() => {
                  const phone = dialValue || search
                  if (phone) handleDial(phone)
                  else toast('Enter a number first')
                }}
                disabled={!dialValue && !search}
                className="w-16 h-16 rounded-full bg-r-teal hover:bg-r-teal/80 active:scale-95 flex items-center justify-center text-white text-2xl transition-all shadow-lg disabled:opacity-40">
                📞
              </button>
              <button
                onClick={() => {
                  setDialValue(v => v.slice(0, -1))
                  setSearch(v => v.slice(0, -1))
                }}
                className="w-16 h-16 rounded-full bg-r-card hover:bg-r-border flex items-center justify-center text-r-muted hover:text-white text-xl transition-all">
                ⌫
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
