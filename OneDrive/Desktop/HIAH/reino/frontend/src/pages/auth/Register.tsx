import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { authAPI } from '@/services/api'
import AuthLayout from '@/components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated } = useStore()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) { navigate('/app/dashboard'); return null }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error('Fill in required fields'); return }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data } = await authAPI.register(form.name, form.email, form.password, form.phone || undefined)
      setAuth(data.token, data.user)
      toast.success(`Welcome to Reino, ${data.user.name}! 🎉`)
      navigate('/app/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Registration failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <AuthLayout title="Create your account" subtitle="Join Reino — free forever">
      <form onSubmit={handle} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Full name *</label>
            <input value={form.name} onChange={f('name')} className="input-field" placeholder="Your name" required />
          </div>
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Phone</label>
            <input value={form.phone} onChange={f('phone')} className="input-field" placeholder="+254700000000" />
          </div>
        </div>
        <div>
          <label className="text-sm text-r-muted mb-1.5 block">Email *</label>
          <input type="email" value={form.email} onChange={f('email')} className="input-field" placeholder="you@email.com" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Password *</label>
            <input type="password" value={form.password} onChange={f('password')} className="input-field" placeholder="Min 6 chars" required />
          </div>
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Confirm *</label>
            <input type="password" value={form.confirm} onChange={f('confirm')} className="input-field" placeholder="Repeat password" required />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2"
          style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>
          {loading ? 'Creating account…' : 'Create Account →'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-r-muted">
        Already have an account? <Link to="/login" className="text-r-accent hover:text-r-accent/80 font-medium">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
