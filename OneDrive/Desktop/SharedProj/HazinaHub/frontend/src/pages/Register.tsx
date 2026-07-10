import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coins, ShieldAlert } from 'lucide-react';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

const countries = [
  { code: '+254', iso: 'ke', name: 'Kenya' },
  { code: '+1', iso: 'us', name: 'United States' },
  { code: '+44', iso: 'gb', name: 'United Kingdom' },
  { code: '+256', iso: 'ug', name: 'Uganda' },
  { code: '+255', iso: 'tz', name: 'Tanzania' },
  { code: '+250', iso: 'rw', name: 'Rwanda' },
  { code: '+27', iso: 'za', name: 'South Africa' },
  { code: '+234', iso: 'ng', name: 'Nigeria' },
];

interface RegisterProps {
  onNavigateToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigateToLogin }) => {
  const { register, loginWithGoogle } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
          document.getElementById('google-signup-button'),
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
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleGlobalClick = () => setDropdownOpen(false);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [dropdownOpen]);

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

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    if (!email) {
      newErrors.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    let cleanedPhone = phone.trim().replace(/\s+/g, '');
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.substring(1);
    }
    const fullPhone = `${countryCode}${cleanedPhone}`;

    const digitCount = fullPhone.replace(/\D/g, '').length;
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (digitCount < 5 || digitCount > 15) {
      newErrors.phone = 'Please enter a valid phone number (5 to 15 digits)';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and a number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim(), // optional, can be empty
        email,
        phone: fullPhone,
        password,
      });
    } catch (err: any) {
      const fieldErrors: Record<string, string> = {};
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        detail.forEach((item: any) => {
          const field = item.loc?.[item.loc.length - 1];
          if (field) {
            const frontendField = field === 'first_name' ? 'firstName'
                                : field === 'last_name' ? 'lastName'
                                : field === 'business_name' ? 'businessName'
                                : field;
            fieldErrors[frontendField] = (item.msg || '').replace(/^Value error,\s*/i, '');
          }
        });
      } else if (typeof detail === 'string') {
        if (detail.toLowerCase().includes('email')) {
          fieldErrors.email = detail;
        } else if (detail.toLowerCase().includes('phone')) {
          fieldErrors.phone = detail;
        } else if (detail.toLowerCase().includes('password')) {
          fieldErrors.password = detail;
        } else {
          fieldErrors.general = detail;
        }
      } else {
        const errorMsg = err.message || 'Registration failed. Please try again.';
        if (errorMsg.toLowerCase().includes('email')) {
          fieldErrors.email = errorMsg;
        } else if (errorMsg.toLowerCase().includes('phone')) {
          fieldErrors.phone = errorMsg;
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

  const currentCountry = countries.find(c => c.code === countryCode) || countries[0];

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            HazinaHub <Coins size={30} color="var(--primary)" />
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Create your account
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                className="input-control"
                placeholder="Bruce"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.firstName;
                      return next;
                    });
                  }
                }}
                required
              />
              {errors.firstName && (
                <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lastName">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                className="input-control"
                placeholder="Ominde"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.lastName;
                      return next;
                    });
                  }
                }}
                required
              />
              {errors.lastName && (
                <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="businessName">
              Business Name (Optional)
            </label>
            <input
              type="text"
              id="businessName"
              className="input-control"
              placeholder="e.g., Hazina Enterprises"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>

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
            <label className="form-label" htmlFor="phone">
              Phone Number
            </label>
            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              {/* Custom Flag Dropdown */}
              <div style={{ position: 'relative', width: '130px' }}>
                <button
                  type="button"
                  onClick={toggleDropdown}
                  className="input-control"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                    padding: '12px 16px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={`https://flagcdn.com/w20/${currentCountry.iso}.png`}
                      alt=""
                      style={{ width: '20px', borderRadius: '2px', objectFit: 'cover' }}
                    />
                    <span>{countryCode}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                </button>

                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      width: '240px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '10px',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
                      zIndex: 10,
                      padding: '6px 0',
                    }}
                  >
                    {countries.map((c) => (
                      <div
                        key={c.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCountryCode(c.code);
                          setDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          color: 'var(--text-main)',
                          fontSize: '0.875rem',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <img
                          src={`https://flagcdn.com/w20/${c.iso}.png`}
                          alt={c.name}
                          style={{ width: '20px', borderRadius: '2px' }}
                        />
                        <span style={{ fontWeight: 600, width: '45px' }}>{c.code}</span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="tel"
                id="phone"
                className="input-control"
                placeholder="712345678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.phone;
                      return next;
                    });
                  }
                }}
                required
              />
            </div>
            {errors.phone && (
              <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {errors.phone}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Create Password
            </label>
            <input
              type="password"
              id="password"
              className="input-control"
              placeholder="Min. 8 characters with letter & number"
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
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          <span style={{ padding: '0 10px' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div id="google-signup-button" style={{ width: '100%', minHeight: '40px', display: 'flex', justifyContent: 'center' }}></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
          <button
            onClick={onNavigateToLogin}
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
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
