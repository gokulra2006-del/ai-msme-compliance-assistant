const User = require('../models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { logAudit } = require('../utils/auditLogger');

const otpStore = new Map();

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const verifyOtpCode = (store, email, otp) => {
  const normalizedEmail = normalizeEmail(email);
  const entry = store.get(normalizedEmail);

  if (!entry) {
    return false;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(normalizedEmail);
    return false;
  }

  const isValid = entry.otp === String(otp).trim();
  if (isValid) {
    store.delete(normalizedEmail);
  }

  return isValid;
};

const sendGmailOtpEmail = async (email, otp) => {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!user || !appPassword) {
    throw new Error('Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env.');
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass: appPassword
    }
  });

  const senderName = process.env.GMAIL_FROM_NAME || 'SurakshaSetu AI';
  const recipientEmail = normalizeEmail(email);

  await transporter.sendMail({
    from: `${senderName} <${user}>`,
    to: recipientEmail,
    subject: 'Your SurakshaSetu OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>Hello,</p>
        <p>Your One-Time Password for SurakshaSetu is:</p>
        <h2 style="letter-spacing: 4px; margin: 16px 0; font-size: 32px; color: #0b5cff;">${otp}</h2>
        <p>This code expires in 5 minutes.</p>
        <p>Use it to verify your email before continuing.</p>
      </div>
    `
  });
};

const buildGoogleUserPayload = (profile) => ({
  name: profile.displayName || profile.name?.givenName || 'Google User',
  email: normalizeEmail(profile.emails?.[0]?.value || profile.email),
  avatar: profile.photos?.[0]?.value || '',
  googleId: profile.id
});

const initializeGoogleStrategy = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    return null;
  }

  passport.use(new GoogleStrategy({
    clientID,
    clientSecret,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const userData = buildGoogleUserPayload(profile);
      let user = await User.findOne({ email: userData.email });

      if (!user) {
        user = await User.create({
          name: userData.name,
          email: userData.email,
          password: `google-oauth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'OWNER'
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  return passport;
};

initializeGoogleStrategy();

const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage
    }
  });
};

exports.generateOtp = generateOtp;
exports.verifyOtpCode = verifyOtpCode;
exports.buildGoogleUserPayload = buildGoogleUserPayload;

exports.googleAuthStart = (req, res, next) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    return res.status(503).json({ success: false, error: 'Google sign-in is not configured yet. Please use email and password instead.' });
  }

  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

exports.googleAuthCallback = (req, res, next) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    return res.redirect('http://localhost:5173/login?google=disabled');
  }

  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login?google=disabled', session: false }, async (err, user) => {
    if (err || !user) {
      return res.redirect('http://localhost:5173/login?google=disabled');
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    });

    const redirectUrl = `http://localhost:5173/login?google_success=1&token=${encodeURIComponent(token)}&user=${encodeURIComponent(user.email)}`;
    return res.redirect(redirectUrl);
  })(req, res, next);
};

exports.sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || process.env.GMAIL_DEFAULT_RECIPIENT || '');
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required to send OTP.' });
    }

    const otp = generateOtp();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    await sendGmailOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}.`,
      email
    });
  } catch (err) {
    const smtpMessage = err.message || 'Failed to send OTP.';
    return res.status(500).json({
      success: false,
      error: smtpMessage.includes('Gmail SMTP')
        ? 'Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env, enable 2-Step Verification, and create an App Password.'
        : smtpMessage
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
    }

    const isValid = verifyOtpCode(otpStore, email, otp);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP.' });
    }

    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const isValid = verifyOtpCode(otpStore, normalizedEmail, otp);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found for this email.' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.create({
      name,
      email,
      password,
      role
    });
    sendTokenResponse(user, 201, res);

    // Audit log
    await logAudit({
      req,
      action: 'REGISTRATION',
      entity: 'User',
      entityId: user._id,
      metadata: { email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Email already exists. Please sign in instead.' });
    }
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logAudit({ req, action: 'FAILED_LOGIN', metadata: { email } });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    req.user = user; // Attach user so audit logger can use user.id
    sendTokenResponse(user, 200, res);

    await logAudit({ req, action: 'LOGIN', entity: 'User', entityId: user._id });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.logout = async (req, res) => {
  await logAudit({ req, action: 'LOGOUT' });
  res.status(200).json({
    success: true,
    data: {}
  });
};

exports.updatePreferences = async (req, res) => {
  try {
    const { preferredLanguage } = req.body;
    if (!preferredLanguage) {
      return res.status(400).json({ success: false, error: 'preferredLanguage is required' });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { preferredLanguage }, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
