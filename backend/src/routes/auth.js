const express = require('express');
const { register, login, getMe, logout, updatePreferences, sendOtp, verifyOtp, resetPassword, googleAuthStart, googleAuthCallback } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/google', googleAuthStart);
router.get('/google/callback', googleAuthCallback);
router.get('/me', protect, getMe);
router.put('/preferences', protect, updatePreferences);

module.exports = router;
