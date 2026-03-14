import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef } from 'react'
import { useStore } from '@/store'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Dashboard     from './Dashboard'
import HiahAgent     from './HiahAgent'
import Contacts      from './Contacts'
import Calls         from './Calls'
import Messages      from './Messages'
import Settings      from './Settings'
import Notifications from './Notifications'

const NAV = [
  { path: 'dashboard',     label: 'Dashboard',    icon: '⬡' },
  { path: 'hiah',          label: 'Hiah',          icon: '◎', badge: 'AI' },
  { path: 'contacts',      label: 'Contacts',      icon: '◈' },
  { path: 'calls',         label: 'Calls',         icon: '◇' },
  { path: 'messages',      label: 'Messages',      icon: '◻' },
  { path: 'notifications', label: 'Notifications', icon: '◆', notif: true },
  { path: 'settings',      label: 'Settings',      icon: '⚙' },
]

// ── Profile modal ─────────────────────────────────────────────
function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser, logout } = useStore()
  const [name, setName]     = useState(user?.name ?? '')
  const [phone, setPhone]   = useState(user?.phone ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? '')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatar(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await authAPI.updateMe({ name, phone, avatar })
      updateUser(data.user)
      toast.success('Profile updated')
      onClose()
    } catch { toast.error('Failed to update profile') }
    finally { setSaving(false) }
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U'

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-white text-lg">Your Profile</h3>
          <button onClick={onClose} className="text-r-muted hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative cursor-pointer group" onClick={() => fileRef.current?.click()}>
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-r-accent/40" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white font-display font-bold text-2xl">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs">Change</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          <p className="text-xs text-r-muted mt-2">Tap to change photo</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-r-muted mb-1 block">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field text-sm py-2.5" />
          </div>
          <div>
            <label className="text-xs text-r-muted mb-1 block">Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field text-sm py-2.5" placeholder="+254..." />
          </div>
          <p className="text-xs text-r-muted">{user?.email}</p>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={() => { logout(); onClose() }} className="btn-danger flex-1">Sign Out</button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ onClose, onProfile }: { onClose: () => void; onProfile: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, unreadCount, syncStatus, isOnline } = useStore()
  const initials  = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U'

  const go = (path: string) => { navigate(`/app/${path}`); onClose() }

  return (
    <aside className="flex flex-col h-full w-64 bg-r-surface border-r border-r-border/50 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-r-border/40">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-white text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
        <div>
          <div className="font-display font-bold text-white leading-tight">Reino</div>
          <div className="text-r-muted text-xs">Daily Assistant</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = location.pathname === `/app/${item.path}`
          return (
            <button key={item.path} onClick={() => go(item.path)}
              className={clsx('nav-item', active && 'active')}>
              <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && <span className="text-xs bg-r-accent/20 text-r-accent px-1.5 py-0.5 rounded-md font-semibold">{item.badge}</span>}
              {item.notif && unreadCount > 0 && (
                <span className="text-xs bg-r-pink text-white w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Sync */}
      <div className="px-4 pb-2">
        <div className={clsx('flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
          isOnline ? 'text-r-teal' : 'text-r-amber bg-r-amber/5')}>
          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0',
            syncStatus === 'syncing' ? 'bg-r-amber animate-pulse' : isOnline ? 'bg-r-teal' : 'bg-r-amber')} />
          {syncStatus === 'syncing' ? 'Syncing…' : isOnline ? 'Online & synced' : 'Offline mode'}
        </div>
      </div>

      {/* Hiah + user */}
      <div className="p-4 border-t border-r-border/40 space-y-3">
        <div className="flex items-center gap-3 bg-r-card rounded-xl p-3 cursor-pointer hover:border-r-accent/20 border border-transparent transition-colors"
          onClick={() => { go('hiah'); onClose() }}>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white font-bold text-sm">H</div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-r-teal border-2 border-r-card" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold">Hiah</div>
            <div className="text-r-teal text-xs">Active</div>
          </div>
          <span className="text-r-accent text-sm">→</span>
        </div>

        {/* User row */}
        <button onClick={onProfile} className="flex items-center gap-2 w-full hover:bg-r-card rounded-xl p-2 transition-colors text-left">
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-r-accent/60 to-r-teal/60 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-r-text truncate">{user?.name}</div>
            <div className="text-xs text-r-muted truncate">{user?.email}</div>
          </div>
          <span className="text-r-muted text-xs">✎</span>
        </button>
      </div>
    </aside>
  )
}

// ── Bottom nav (mobile) ───────────────────────────────────────
function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount } = useStore()

  const mobileNav = [
    { path: 'dashboard', icon: '⬡', label: 'Home' },
    { path: 'hiah',      icon: '◎', label: 'Hiah' },
    { path: 'calls',     icon: '◇', label: 'Calls' },
    { path: 'messages',  icon: '◻', label: 'SMS' },
    { path: 'notifications', icon: '◆', label: 'Alerts', notif: true },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-r-surface/95 backdrop-blur-sm border-t border-r-border/50 flex">
      {mobileNav.map(item => {
        const active = location.pathname === `/app/${item.path}`
        return (
          <button key={item.path} onClick={() => navigate(`/app/${item.path}`)}
            className={clsx('flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors relative',
              active ? 'text-r-accent' : 'text-r-muted hover:text-r-text')}>
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.notif && unreadCount > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full bg-r-pink text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── TopBar ────────────────────────────────────────────────────
function TopBar({ onMenu, onProfile }: { onMenu: () => void; onProfile: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, unreadCount } = useStore()
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => void } | null>(null)
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U'
  const title = NAV.find(n => location.pathname === `/app/${n.path}`)?.label ?? 'Reino'

  return (
    <header className="h-14 bg-r-surface/90 border-b border-r-border/40 backdrop-blur-sm flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-30">
      <button onClick={onMenu}
        className="lg:hidden w-9 h-9 rounded-lg hover:bg-r-card flex flex-col items-center justify-center gap-1.5 transition-colors flex-shrink-0">
        <span className="w-5 h-0.5 bg-r-text rounded" />
        <span className="w-5 h-0.5 bg-r-text rounded" />
        <span className="w-3 h-0.5 bg-r-text rounded self-start ml-1" />
      </button>

      {/* Mobile brand */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-white text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
      </div>

      <h1 className="font-display font-semibold text-white text-base sm:text-lg flex-1 truncate">{title}</h1>

      {/* Notifications */}
      <button onClick={() => navigate('/app/notifications')}
        className="relative w-9 h-9 rounded-lg hover:bg-r-card flex items-center justify-center transition-colors text-r-muted hover:text-white flex-shrink-0">
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-r-pink text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* User avatar */}
      <button onClick={onProfile}
        className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-r-accent/30 hover:border-r-accent/60 transition-colors">
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white font-bold text-xs">
            {initials}
          </div>
        )}
      </button>
    </header>
  )
}

// ── AppShell ──────────────────────────────────────────────────
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-r-bg">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed top-0 left-0 h-full z-50 transition-transform duration-300 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar onClose={() => setSidebarOpen(false)} onProfile={() => { setProfileOpen(true); setSidebarOpen(false) }} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenu={() => setSidebarOpen(v => !v)} onProfile={() => setProfileOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="hiah"          element={<HiahAgent />} />
            <Route path="contacts"      element={<Contacts />} />
            <Route path="calls"         element={<Calls />} />
            <Route path="messages"      element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings"      element={<Settings />} />
            <Route path="*"             element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Profile modal */}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
