import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const GoogleGIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.61l6.85-6.85C35.99 2.38 30.66 0 24 0 14.64 0 6.58 5.38 2.56 13.22l7.98 6.18C12.4 13.68 17.63 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.12-.42-4.58H24v8.68h12.74c-.56 3-2.4 5.53-5.11 7.23l8.27 6.41C43.7 36.7 46.5 31.28 46.5 24.5z" />
    <path fill="#FBBC05" d="M31.63 35.8c-2.13 1.42-4.86 2.2-7.63 2.2-6.37 0-11.76-4.3-13.7-10.08l-8.14 6.3C4.62 42.5 13.34 48 24 48c7.2 0 13.26-2.37 17.67-6.44l-9.04-5.76z" />
    <path fill="#34A853" d="M11.38 27.92A14.57 14.57 0 0 1 10.5 24c0-1.63.29-3.2.81-4.68L2.56 13.22A23.4 23.4 0 0 0 0 24c0 3.77.9 7.34 2.56 10.52l8.82-6.6z" />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(email);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get('google') === 'disabled') {
      setError('Google sign-in is not configured yet. Please use email and password to continue.');
    }

    const token = params.get('token');
    const userEmail = params.get('user');
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (token && userEmail) {
      localStorage.setItem('token', token);
      login(token, {
        id: userEmail,
        name: userEmail.split('@')[0],
        email: userEmail,
        role: 'OWNER'
      });
      navigate('/dashboard', { replace: true });
    }
  }, [location.search, login, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async () => {
    if (!forgotEmail) {
      setError('Please enter the email address first.');
      return;
    }

    setForgotLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post('http://localhost:5000/api/auth/send-otp', { email: forgotEmail });
      setOtpSent(true);
      setOtpVerified(false);
      setSuccess(`OTP sent to ${forgotEmail}.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to send reset OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!forgotOtp) {
      setError('Please enter the OTP you received.');
      return;
    }

    setForgotLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post('http://localhost:5000/api/auth/verify-otp', { email: forgotEmail, otp: forgotOtp });
      setOtpVerified(true);
      setSuccess('OTP verified successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
      setOtpVerified(false);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail || !forgotOtp) {
      setError('Please verify the OTP before resetting your password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post('http://localhost:5000/api/auth/reset-password', {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword
      });
      setSuccess('Password reset successful. You can sign in now.');
      setShowForgot(false);
      setForgotEmail(email);
      setForgotOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpSent(false);
      setOtpVerified(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const logoStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
    display: 'block',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 0 rgba(77, 214, 154, 0))'
  };

  return (
    <div className="auth-split">
      <div className="auth-split-left">
        <motion.div
          className="auth-form-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login-brand-row">
            <img src="/logo.svg" alt="SurakshaSetu AI logo" style={logoStyle} />
            <span>SurakshaSetu AI</span>
          </div>

          <div className="login-header-block">
            <h1>Sign in</h1>
            <p>Access your compliance dashboard.</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="error-box"
            >
              <span style={{ marginRight: '8px' }}>⚠</span> {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="success-box"
              style={{ marginBottom: '18px' }}
            >
              <span style={{ marginRight: '8px' }}>✓</span> {success}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label>Email address</label>
              <input
                type="email"
                className="premium-input"
                placeholder="test@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field password-row">
              <div className="login-password-head">
                <label>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(true);
                    setForgotEmail(email);
                    setError('');
                    setSuccess('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--accent)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                className="premium-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="premium-btn" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="16 16" opacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>

            <button
              type="button"
              className="google-btn"
              onClick={() => {
                window.location.href = 'http://localhost:5000/api/auth/google';
              }}
            >
              <span className="google-icon" aria-hidden="true"><GoogleGIcon /></span>
              Continue with Google
            </button>
          </form>

          <div className="login-signup-row">
            Don't have an account? <Link to="/register">Create one</Link>
          </div>
        </motion.div>
      </div>

      {showForgot && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowForgot(false)}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            padding: '24px',
            color: 'var(--text-primary)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Reset password</h3>
              <button type="button" onClick={() => setShowForgot(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            </div>

            {!otpVerified ? (
              <>
                <div className="login-field" style={{ marginBottom: '16px' }}>
                  <label>Email address</label>
                  <input
                    type="email"
                    className="premium-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>

                {!otpSent ? (
                  <button type="button" className="premium-btn" onClick={handleSendResetOtp} disabled={forgotLoading}>
                    {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                ) : (
                  <>
                    <div className="login-field" style={{ marginBottom: '16px' }}>
                      <label>OTP</label>
                      <input
                        type="text"
                        className="premium-input"
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                      />
                    </div>
                    <button type="button" className="premium-btn" onClick={handleVerifyResetOtp} disabled={forgotLoading}>
                      {forgotLoading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="login-field" style={{ marginBottom: '16px' }}>
                  <label>New password</label>
                  <input
                    type="password"
                    className="premium-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="login-field" style={{ marginBottom: '16px' }}>
                  <label>Confirm password</label>
                  <input
                    type="password"
                    className="premium-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <button type="button" className="premium-btn" onClick={handleResetPassword} disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting...' : 'Reset password'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="auth-split-right">
        <div className="login-visual-wrap">
          <div className="brand-illustration">
            <img src="/logo.svg" alt="SurakshaSetu AI" />
          </div>
          <div className="brand-name-large">SurakshaSetu AI</div>
          <div className="brand-tagline">Comply • Prepare • Grow</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
