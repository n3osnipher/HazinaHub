import { useState } from 'react'
import { useStore } from '@/store'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import CustomDialer from '@/components/dialer/CustomDialer'
import type { CallRecord } from '@/types'

const STATUS_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  ringing:   { label: 'Ringing',   color: 'text-r-amber',  icon: '📳' },
  outgoing:  { label: 'Outgoing',  color: 'text-blue-400', icon: '📲' },
  incoming:  { label: 'Incoming',  color: 'text-r-teal',   icon: '📞' },
  ongoing:   { label: 'Ongoing',   color: 'text-r-teal',   icon: '🟢' },
  called:    { label: 'Called',    color: 'text-r-muted',  icon: '✅' },
  ended:     { label: 'Ended',     color: 'text-r-muted',  icon: '⬜' },
  missed:    { label: 'Missed',    color: 'text-red-400',  icon: '📵' },
  rejected:  { label: 'Rejected',  color: 'text-red-400',  icon: '🚫' },
  failed:    { label: 'Failed',    color: 'text-red-400',  icon: '❌' },
  voicemail: { label: 'Voicemail', color: 'text-r-muted',  icon: '📨' },
}

function CallItem({ call }: { call: CallRecord }) {
  const st = STATUS_STYLES[call.status] ?? { label: call.status, color: 'text-r-muted', icon: '◇' }
  const duration = call.duration
    ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
    : null

  return (
    <div className={clsx('card p-3.5 flex items-center gap-3',
      call.status === 'missed' && 'border-red-500/20',
      call.is_spam && 'border-red-500/30 bg-red-500/5',
      (call.status === 'ongoing' || call.status === 'ringing') && 'border-r-teal/30 bg-r-teal/5'
    )}>
      <div className="text-xl flex-shrink-0">{st.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-white text-sm truncate">{call.contact_name}</p>
          {call.is_spam    && <span className="badge bg-red-500/15 text-red-400 text-xs">Spam</span>}
          {call.is_unknown && !call.is_spam && <span className="badge bg-r-amber/15 text-r-amber text-xs">Unknown</span>}
          {call.by_hiah    && <span className="badge badge-hiah text-xs">Hiah</span>}
        </div>
        <p className="text-xs text-r-muted">{call.phone} · SIM{call.sim_slot + 1} · {call.isp}</p>
        {call.hiah_notes && <p className="text-xs text-r-accent mt-0.5">⚡ {call.hiah_notes}</p>}
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className={clsx('text-xs font-medium', st.color)}>{st.label}</p>
        <p className="text-xs text-r-muted">{format(new Date(call.started_at), 'MMM d, HH:mm')}</p>
        {duration && <p className="text-xs text-r-teal">{duration}</p>}
      </div>
    </div>
  )
}

export default function Calls() {
  const { calls } = useStore()
  const navigate  = useNavigate()
  const [dialerOpen, setDialerOpen] = useState(false)
  const [filter, setFilter]         = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all')
  const [search, setSearch]         = useState('')

  const filtered = calls.filter(c => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'missed' ? c.status === 'missed' :
      filter === 'incoming' ? c.direction === 'inbound' :
      c.direction === 'outbound'
    const matchSearch = !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    return matchFilter && matchSearch
  })

  const missedCount = calls.filter(c => c.status === 'missed').length

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header actions */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-r-border/40 space-y-3">
        <div className="flex gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search calls…" className="input-field flex-1 text-sm py-2.5" />
          <button onClick={() => setDialerOpen(true)}
            className="btn-primary px-4 whitespace-nowrap flex items-center gap-2 text-sm">
            <span className="text-base">📞</span> Dial
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all','missed','incoming','outgoing'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('text-xs px-3 py-1.5 rounded-lg border font-medium capitalize transition-all',
                filter === f ? 'bg-r-accent/20 text-r-accent border-r-accent/40' : 'bg-r-card text-r-muted border-r-border hover:text-r-text')}>
              {f}{f === 'missed' && missedCount > 0 ? ` (${missedCount})` : ''}
            </button>
          ))}
          <button onClick={() => navigate('/app/hiah')}
            className="ml-auto text-xs text-r-accent hover:text-r-accent/80 px-2 py-1.5">
            ⚡ Ask Hiah to call →
          </button>
        </div>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-r-muted">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">No {filter === 'all' ? '' : filter} calls found</p>
          </div>
        )}
        {filtered.map(c => <CallItem key={c.id} call={c} />)}
      </div>

      {/* Custom dialer */}
      {dialerOpen && <CustomDialer onClose={() => setDialerOpen(false)} />}
    </div>
  )
}
