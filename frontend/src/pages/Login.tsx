import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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

  // SurakshaSetu (Rule Bridge) Brand Expression
  const SurakshaSetuBrand = () => {
    const leftCables = [
      {x: 120, y1: 244, y2: 258},
      {x: 140, y1: 228, y2: 257},
      {x: 160, y1: 212, y2: 255.5},
      {x: 180, y1: 196, y2: 254},
    ];
    const rightCables = [
      {x: 280, y1: 244, y2: 258},
      {x: 260, y1: 228, y2: 257},
      {x: 240, y1: 212, y2: 255.5},
      {x: 220, y1: 196, y2: 254},
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Background ambient glow */}
        <div style={{ position: 'absolute', width: '800px', height: '600px', background: 'radial-gradient(ellipse at 50% 50%, rgba(0,230,118,0.08) 0%, rgba(59,130,246,0.05) 40%, rgba(0,0,0,0) 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0 }} />
        
        {/* Abstract Architectural SVG Logo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative', zIndex: 1, width: '400px', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" /> {/* Blue hint */}
                <stop offset="100%" stopColor="rgba(0, 230, 118, 0.05)" /> {/* Green hint */}
              </linearGradient>
              <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" /> {/* Brand Blue */}
                <stop offset="100%" stopColor="#00E676" /> {/* Brand Green */}
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Shield Outline */}
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              d="M 200 40 L 320 80 L 320 220 C 320 300 200 360 200 360 C 200 360 80 300 80 220 L 80 80 Z"
              fill="url(#shieldGrad)"
              stroke="rgba(59, 130, 246, 0.6)"
              strokeWidth="3"
            />

            {/* The "S" Curve Ribbon */}
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
              d="M 300 110 C 180 110 120 180 200 210 C 280 240 220 310 100 310"
              fill="none"
              stroke="url(#sGrad)"
              strokeWidth="28"
              strokeLinecap="round"
              style={{ filter: 'url(#glow)' }}
            />

            {/* The Bridge (Central Pillar + Suspension) */}
            <motion.g
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 1.2, ease: "easeOut" }}
            >
              {/* Central Pillar */}
              <path d="M 192 180 L 208 180 L 214 340 L 186 340 Z" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" />
              <path d="M 200 180 L 208 180 L 214 340 L 200 340 Z" fill="rgba(59, 130, 246, 0.2)" />
              
              {/* Bridge Deck */}
              <path d="M 80 260 Q 200 245 320 260 L 320 270 Q 200 255 80 270 Z" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" />
              
              {/* Main Suspension Cables */}
              <path d="M 200 180 L 80 260 M 200 180 L 320 260" stroke="#00E676" strokeWidth="2.5" fill="none" style={{ filter: 'url(#glow)' }} />
              
              {/* Vertical Support Cables */}
              {leftCables.map((c, i) => (
                <line key={`lc-${i}`} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} stroke="rgba(0, 230, 118, 0.6)" strokeWidth="1.5" />
              ))}
              {rightCables.map((c, i) => (
                <line key={`rc-${i}`} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} stroke="rgba(0, 230, 118, 0.6)" strokeWidth="1.5" />
              ))}
            </motion.g>
          </svg>
        </motion.div>

        {/* Narrative typography */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.8 }}
          style={{ position: 'absolute', bottom: '60px', textAlign: 'center', zIndex: 10, width: '100%', padding: '0 40px' }}
        >
          <p style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px' }}>
            SurakshaSetu AI
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '340px', margin: '0 auto', lineHeight: 1.5 }}>
            Comply • Prepare • Grow
          </p>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="auth-split">
      {/* Left Side: Form */}
      <div className="auth-split-left">
        <motion.div 
          className="auth-form-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <div style={{ width: '10px', height: '10px', background: '#00E676', borderRadius: '2px', boxShadow: '0 0 12px rgba(0,230,118,0.4)' }} />
            <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#fff' }}>SurakshaSetu AI</span>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginBottom: '8px' }}>
              Sign in
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Access your compliance dashboard.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="error-box"
              style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', padding: '12px 16px', fontSize: '0.9rem', marginBottom: '24px' }}
            >
              <span style={{ marginRight: '8px' }}>⚠</span> {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Email address</label>
              <input 
                type="email" 
                className="premium-input" 
                placeholder="you@company.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                <a href="#" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Forgot password?</a>
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
          </form>

          <div style={{ marginTop: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Don't have an account? <Link to="/register" style={{ color: '#fff', fontWeight: 500, marginLeft: '4px' }}>Create one</Link>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Brand Expression */}
      <div className="auth-split-right">
        <SurakshaSetuBrand />
      </div>
    </div>
  );
};

export default Login;
