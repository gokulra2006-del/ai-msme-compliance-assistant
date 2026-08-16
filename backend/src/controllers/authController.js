const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger');

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
