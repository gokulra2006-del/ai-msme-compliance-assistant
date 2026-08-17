import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('dishvit55@gmail.com');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }

    setOtpSending(true);
    setError('');
    try {
      await axios.post('http://localhost:5000/api/auth/send-otp', { email });
      setOtpSent(true);
      setOtpVerified(false);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to send OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!email || !otp) {
      setError('Please enter the OTP sent to your email.');
      return;
    }

    setOtpVerifying(true);
    setError('');
    try {
      await axios.post('http://localhost:5000/api/auth/verify-otp', { email, otp });
      setOtpVerified(true);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP.');
      setOtpVerified(false);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!otpVerified) {
        throw new Error('Please verify your email with the OTP before creating the account.');
      }

      const res = await axios.post('http://localhost:5000/api/auth/register', {
        name, email, password, role: 'OWNER', otp
      });
      login(res.data.token, res.data.user);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>SurakshaSetu AI</span>
          </div>
          <h1>Create your account</h1>
          <p>Verify your email with OTP before continuing.</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" placeholder="Priya Sharma" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="dishvit55@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: 0 }} onClick={handleSendOtp} disabled={otpSending}>
              {otpSending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>
          </div>

          {otpSent && (
            <div className="form-group">
              <label className="form-label">OTP</label>
              <input type="text" className="form-input" placeholder="Enter 6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} required />
              <button type="button" className="btn btn-accent" style={{ width: '100%', marginTop: '10px' }} onClick={handleVerifyOtp} disabled={otpVerifying}>
                {otpVerifying ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="Create a strong password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '8px' }} disabled={loading || !otpVerified}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
