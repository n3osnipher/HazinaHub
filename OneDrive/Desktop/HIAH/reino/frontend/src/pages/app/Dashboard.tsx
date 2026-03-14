import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { format } from 'date-fns'
import clsx from 'clsx'

function greeting(name: string) {
  const h = new Date().getHours()
  const t = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${t}, ${name} 👋`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, calls, messages, notifications, unreadCount } = useStore()

  const missedCalls   = calls.filter(c => c.status === 'missed').length
  const unreadMsgs    = messages.filter(m => !m.is_read).length
  const hiahActions   = calls.filter(c => c.by_hiah).length + messages.filter(m => m.by_hiah).length

  const simCards = user?.sim_cards ?? []

  // Recent activity - last 6 items across calls + messages
  const activity = [
    ...messages.slice(0, 5).map(m => ({
      id: m.id, label: 'SMS', color: 'text-blue-400 bg-blue-500/10',
      title: m.contact_name, body: m.body,
      time: m.timestamp, unread: !m.is_read, type: 'message'
    })),
    ...calls.slice(0, 5).map(c => ({
      id: c.id, label: 'CALL', color: c.status === 'missed' ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10',
      title: c.contact_name, body: c.status === 'missed' ? 'Missed call' : `${c.direction} · ${c.duration ? Math.round(c.duration / 60) + 'min' : c.status}`,
      time: c.started_at, unread: c.status === 'missed', type: 'call'
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)

  const stats = [
    { icon: '📞', label: 'Calls Today', value: calls.length,    sub: `${missedCalls} missed`,  path: 'calls',    gradient: 'from-green-500/20 to-green-500/5' },
    { icon: '💬', label: 'Messages',    value: messages.length, sub: `${unreadMsgs} unread`,   path: 'messages', gradient: 'from-blue-500/20 to-blue-500/5' },
    { icon: '🔔', label: 'Alerts',      value: notifications.length, sub: `${unreadCount} unread`, path: 'notifications', gradient: 'from-r-accent/20 to-r-accent/5' },
    { icon: '⚡', label: 'Hiah Actions',value: hiahActions,     sub: 'performed by Hiah', path: 'hiah',     gradient: 'from-r-teal/20 to-r-teal/5' },
  ]

  const quickActions = [
    { icon: '📞', label: 'Call Someone',  prompt: '/app/hiah' },
    { icon: '💬', label: 'Send SMS',       prompt: '/app/hiah' },
    { icon: '📋', label: 'Contacts',       prompt: '/app/contacts' },
    { icon: '📜', label: 'Call History',   prompt: '/app/calls' },
    { icon: '📩', label: 'Read Messages',  prompt: '/app/messages' },
    { icon: '⚙',  label: 'Settings',       prompt: '/app/settings' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">{greeting(user?.name ?? 'there')}</h2>
          <p className="text-r-muted text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d')} · Hiah is watching your channels</p>
        </div>
        <button onClick={() => navigate('/app/hiah')} className="relative flex-shrink-0 group">
          <div className="absolute inset-0 rounded-full bg-r-accent/20 scale-110 group-hover:scale-125 transition-transform animate-pulse-ring" />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white font-display font-bold text-xl">H</div>
          <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-r-teal whitespace-nowrap">Talk to Hiah</p>
        </button>
      </div>

      {/* SIM cards */}
      {simCards.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {simCards.map(sim => (
            <div key={sim.slot} className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
              sim.is_default ? 'bg-r-accent/10 border-r-accent/30 text-r-accent' : 'bg-r-card border-r-border text-r-muted'
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-r-teal" />
              SIM{sim.slot + 1} · {sim.isp ?? 'Unknown'} {sim.phone_number ? `· ${sim.phone_number}` : ''}
              {sim.is_default && <span className="text-r-accent/60">Default</span>}
            </div>
          ))}
        </div>
      )}

      {/* Hiah promo */}
      <div className="bg-gradient-to-r from-r-accent/10 to-r-teal/10 border border-r-accent/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-r-accent/20 flex items-center justify-center text-xl flex-shrink-0">⚡</div>
        <div className="flex-1">
          <p className="text-white font-semibold">Hiah performed <span className="text-r-accent">{hiahActions} actions</span> for you</p>
          <p className="text-r-muted text-xs mt-0.5">Auto-managed calls, SMS alerts, and notifications on your behalf</p>
        </div>
        <button onClick={() => navigate('/app/hiah')} className="btn-primary text-sm py-2 px-4 whitespace-nowrap flex-shrink-0">Chat →</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <button key={s.label} onClick={() => navigate(s.path)}
            className={clsx('card p-4 text-left hover:scale-[1.02] active:scale-[0.98] transition-transform bg-gradient-to-br', s.gradient)}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-display text-3xl font-bold text-white">{s.value}</div>
            <div className="text-r-text text-sm font-medium mt-0.5">{s.label}</div>
            <div className="text-r-muted text-xs mt-0.5">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header mb-0">Recent Activity</h3>
          <span className="flex items-center gap-1.5 text-xs text-r-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-r-teal animate-pulse" />Live
          </span>
        </div>
        <div className="space-y-2">
          {activity.length === 0 && (
            <div className="card p-8 text-center text-r-muted">
              <p className="text-3xl mb-2">📭</p>
              <p>No activity yet. Your calls and messages will appear here.</p>
            </div>
          )}
          {activity.map(item => (
            <div key={item.id} onClick={() => navigate(item.type === 'message' ? '/app/messages' : '/app/calls')}
              className={clsx('card p-3 flex items-center gap-3 hover:border-r-border cursor-pointer transition-colors', item.unread && 'border-r-accent/20')}>
              <div className={clsx('w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center flex-shrink-0', item.color)}>{item.label}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  {item.unread && <span className="w-2 h-2 rounded-full bg-r-pink flex-shrink-0" />}
                </div>
                <p className="text-xs text-r-muted truncate">{item.body}</p>
              </div>
              <span className="text-xs text-r-muted flex-shrink-0">{format(new Date(item.time), 'HH:mm')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="section-header">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickActions.map(a => (
            <button key={a.label} onClick={() => navigate(a.prompt)}
              className="card p-3 flex items-center gap-3 hover:border-r-accent/30 hover:bg-r-accent/5 transition-all active:scale-95 text-left">
              <span className="text-xl">{a.icon}</span>
              <span className="text-sm font-medium text-r-text">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
