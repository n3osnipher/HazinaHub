import React, { useState } from 'react';
import api from '../services/api';
import { Coins, Mail, ArrowLeft } from 'lucide-react';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
  onSuccess: () => void;
}

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    setSuccessMessage(null);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.success) {
        setSuccessMessage('Password reset email sent! Please check your inbox.');
      } else {
        setErrors({ email: response.data.error || 'Failed to send reset link.' });
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : err.message || 'Failed to send reset link.';
      setErrors({ email: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            HazinaHub <Coins size={30} color="var(--primary)" />
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Reset your account password
          </p>
        </div>

        {successMessage ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: 'var(--primary)',
                padding: '16px',
                borderRadius: '10px',
                marginBottom: '24px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </div>

            <button
              onClick={onNavigateToLogin}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  id="email"
                  className="input-control"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors({});
                    }
                  }}
                  required
                />
              </div>
              {errors.email && (
                <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {errors.email}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(4, 47, 26, 0.2)',
                    borderTopColor: '#042f1a',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <span>Sending Link...</span>
                </>
              ) : (
                <>
                  <Mail size={18} /> Send Reset Link
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateToLogin}
              className="btn btn-glass"
              style={{ width: '100%', padding: '12px', marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
