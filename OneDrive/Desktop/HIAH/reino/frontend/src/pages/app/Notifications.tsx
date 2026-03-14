import { useStore } from '@/store'
import { notifAPI } from '@/services/api'
import { format } from 'date-fns'
import clsx from 'clsx'

const icons: Record<string, string> = { call: '📞', message: '💬', hiah: '⚡', system: '🔔' }
const colors: Record<string, string> = {
  urgent: 'border-red-500/40', high: 'border-r-pink/30', normal: '', low: 'opacity-60'
}

export default function Notifications() {
  const { notifications, markNotifRead, markAllNotifRead } = useStore()
  const unread = notifications.filter(n => !n.is_read).length

  const handleRead = async (id: string) => {
    markNotifRead(id)
    try { await notifAPI.markRead(id) } catch { /* offline ok */ }
  }

  const handleReadAll = async () => {
    markAllNotifRead()
    try { await notifAPI.markAllRead() } catch { /* offline ok */ }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-r-muted text-sm">{unread} unread</p>
        {unread > 0 && (
          <button onClick={handleReadAll} className="text-xs text-r-accent hover:text-r-accent/80 transition-colors">
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="card p-12 text-center text-r-muted">
            <p className="text-3xl mb-2">🔔</p>
            <p>No notifications yet</p>
          </div>
        )}
        {notifications.map(n => (
          <div key={n.id} onClick={() => handleRead(n.id)}
            className={clsx(
              'card p-4 flex gap-3 cursor-pointer hover:border-r-border transition-colors',
              colors[n.priority],
              !n.is_read && 'border-l-2 border-l-r-accent'
            )}>
            <span className="text-xl flex-shrink-0 mt-0.5">{icons[n.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={clsx('text-sm font-semibold truncate', !n.is_read ? 'text-white' : 'text-r-text')}>{n.title}</p>
                <span className="text-xs text-r-muted flex-shrink-0">{format(new Date(n.created_at), 'HH:mm')}</span>
              </div>
              <p className="text-xs text-r-muted mt-0.5">{n.body}</p>
              {n.priority === 'urgent' && <span className="badge bg-red-500/10 text-red-400 mt-1 inline-block">Urgent</span>}
            </div>
            {!n.is_read && <div className="w-2 h-2 rounded-full bg-r-accent flex-shrink-0 mt-2" />}
          </div>
        ))}
      </div>
    </div>
  )
}
