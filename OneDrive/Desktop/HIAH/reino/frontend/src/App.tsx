import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { useSync } from '@/hooks/useSync'
import AppLock from '@/components/security/AppLock'

// Landing / Auth
import Landing  from '@/pages/Landing'
import Login    from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Forgot   from '@/pages/auth/Forgot'
import Reset    from '@/pages/auth/Reset'

// App shell
import AppShell from '@/pages/app/AppShell'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppWithLock({ children }: { children: React.ReactNode }) {
  const { user } = useStore()
  const [locked, setLocked] = useState(false)
  const sec = user?.settings?.security

  useEffect(() => {
    // Show lock screen on mount if lock is enabled
    if (sec?.lock_enabled && sec.lock_type !== 'none') {
      setLocked(true)
    }
  }, [sec?.lock_enabled, sec?.lock_type])

  useEffect(() => {
    if (!sec?.lock_enabled || !sec?.lock_on_background) return
    const handleVisibility = () => {
      if (document.hidden) {
        // Arm re-lock when app returns to foreground
        const timeHidden = Date.now()
        const checkOnReturn = () => {
          if (!document.hidden) {
            const minutesAway = (Date.now() - timeHidden) / 60000
            const threshold   = sec.auto_lock_minutes ?? 5
            if (threshold === 0 || minutesAway >= threshold) {
              setLocked(true)
            }
            document.removeEventListener('visibilitychange', checkOnReturn)
          }
        }
        document.addEventListener('visibilitychange', checkOnReturn)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [sec])

  if (locked) {
    return <AppLock onUnlock={() => setLocked(false)} />
  }
  return <>{children}</>
}

export default function App() {
  const { logout } = useStore()
  useSync()

  useEffect(() => {
    const handle = () => logout()
    window.addEventListener('reino:unauthorized', handle)
    return () => window.removeEventListener('reino:unauthorized', handle)
  }, [logout])

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot"   element={<Forgot />} />
        <Route path="/reset"    element={<Reset />} />

        {/* Protected app */}
        <Route path="/app/*" element={
          <AuthGuard>
            <AppWithLock>
              <AppShell />
            </AppWithLock>
          </AuthGuard>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e', color: '#e8e8f0',
            border: '1px solid #2a2a45', borderRadius: '12px',
            fontFamily: 'DM Sans, sans-serif',
          },
          success: { iconTheme: { primary: '#00d4aa', secondary: '#0d0d1a' } },
          error:   { iconTheme: { primary: '#ff6b9d', secondary: '#0d0d1a' } },
        }}
      />
    </>
  )
}
