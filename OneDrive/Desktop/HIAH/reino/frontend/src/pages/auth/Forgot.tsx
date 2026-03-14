// Forgot.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '@/services/api'
import AuthLayout from '@/components/layout/AuthLayout'
import toast from 'react-hot-toast'

export function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
    } catch { toast.error('Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll send a reset link to your email">
      {sent ? (
        <div className="text-center space-y-4">
          <div className="text-5xl">📧</div>
          <p className="text-r-text">Check your inbox at <strong>{email}</strong>.</p>
          <p className="text-r-muted text-sm">Didn't receive it? Check spam or try again.</p>
          <Link to="/login" className="btn-primary block text-center py-3">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-sm text-r-muted mb-1.5 block">Your email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-field" placeholder="you@email.com" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="text-center text-sm text-r-muted"><Link to="/login" className="text-r-accent">Back to login</Link></p>
        </form>
      )}
    </AuthLayout>
  )
}

export default Forgot
