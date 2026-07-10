import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coins, ShieldAlert } from 'lucide-react';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onNavigateToRegister, onNavigateToForgotPassword }) => {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load Google Identity Services SDK
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      const google = (window as any).google;
      if (google) {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '268481353363-mockclientid.apps.googleusercontent.com',
          callback: handleGoogleCallback,
        });
        google.accounts.id.renderButton(
          document.getElementById('google-signin-button'),
          { 
            theme: 'outline', 
            size: 'large', 
            width: 380,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left'
          }
        );
      }
    };

    return () => {
      // Safely cleanup the script if it was attached
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  const handleGoogleCallback = async (response: any) => {
    setSubmitting(true);
    setErrors({});
    try {
      await loginWithGoogle(response.credential);
    } catch (err: any) {
      setErrors({ general: err.message || 'Google Sign-In failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      const fieldErrors: Record<string, string> = {};
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        detail.forEach((item: any) => {
          const field = item.loc?.[item.loc.length - 1];
          if (field) {
            fieldErrors[field] = (item.msg || '').replace(/^Value error,\s*/i, '');
          }
        });
      } else if (typeof detail === 'string') {
        if (detail.toLowerCase().includes('email')) {
          fieldErrors.email = detail;
        } else if (detail.toLowerCase().includes('password')) {
          fieldErrors.password = detail;
        } else {
          fieldErrors.general = detail;
        }
      } else {
        const errorMsg = err.message || 'Login failed. Please try again.';
        if (errorMsg.toLowerCase().includes('email')) {
          fieldErrors.email = errorMsg;
        } else if (errorMsg.toLowerCase().includes('password')) {
          fieldErrors.password = errorMsg;
        } else {
          fieldErrors.general = errorMsg;
        }
      }
      setErrors(fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '460px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '2.25rem', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            HazinaHub <Coins size={32} color="var(--primary)" />
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Empowering your financial future
          </p>
        </div>

        {errors.general && (
          <div
            style={{
              background: 'var(--danger-glow)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldAlert size={16} />
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="input-control"
              placeholder="e.g., info@business.co.ke"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors(prev => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
              required
            />
            {errors.email && (
              <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {errors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={onNavigateToForgotPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              id="password"
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors(prev => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }
              }}
              required
            />
            {errors.password && (
              <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {errors.password}
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
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          <span style={{ padding: '0 10px' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div id="google-signin-button" style={{ width: '100%', minHeight: '40px', display: 'flex', justifyContent: 'center' }}></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Don't have an account? </span>
          <button
            onClick={onNavigateToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Create one now
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
