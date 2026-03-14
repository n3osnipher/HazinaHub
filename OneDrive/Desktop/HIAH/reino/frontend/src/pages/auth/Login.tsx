import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { authAPI } from '@/services/api'
import AuthLayout from '@/components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated } = useStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) { navigate('/app/dashboard'); return null }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Fill in all fields'); return }
    setLoading(true)
    try {
      const { data } = await authAPI.login(form.email, form.password)
      setAuth(data.token, data.user)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/app/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Login failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Reino account">
      <form onSubmit={handle} className="space-y-4">
        <div>
          <label className="text-sm text-r-muted mb-1.5 block">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            className="input-field" placeholder="you@email.com" autoComplete="email" required />
        </div>
        <div>
          <label className="text-sm text-r-muted mb-1.5 block">Password</label>
          <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            className="input-field" placeholder="••••••••" autoComplete="current-password" required />
        </div>
        <div className="text-right">
          <Link to="/forgot" className="text-sm text-r-accent hover:text-r-accent/80">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-r-muted">
        No account? <Link to="/register" className="text-r-accent hover:text-r-accent/80 font-medium">Create one free</Link>
      </p>
    </AuthLayout>
  )
}
