const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Strict rate limiting for AI endpoint
const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 AI requests per windowMs
  message: {
    success: false,
    error: 'Too many requests to the AI Assistant. Please wait a few minutes before asking again.'
  }
});

router.post('/chat', protect, assistantLimiter, chat);

module.exports = router;
