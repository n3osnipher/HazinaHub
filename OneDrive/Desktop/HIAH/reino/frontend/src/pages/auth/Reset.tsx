import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '@/services/api'
import AuthLayout from '@/components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function Reset() {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const token     = params.get('token') ?? ''
  const [form, setForm]   = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Min 6 characters'); return }
    if (!token) { toast.error('Invalid reset link'); return }
    setLoading(true)
    try {
      await authAPI.resetPassword(token, form.password)
      toast.success('Password updated! Please sign in.')
      navigate('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Reset failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      {!token ? (
        <div className="text-center space-y-3">
          <p className="text-r-muted">Invalid or missing reset token.</p>
          <Link to="/forgot" className="btn-primary block py-3 text-center">Request new link</Link>
        </div>
      ) : (
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">New password</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="input-field" placeholder="Min 6 characters" required />
          </div>
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Confirm password</label>
            <input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              className="input-field" placeholder="Repeat password" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
