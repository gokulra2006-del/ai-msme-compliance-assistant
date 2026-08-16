# 🔧 Developer Cheat Sheet

Quick reference for developers working with this system.

---

## 🚀 Quickstart Commands

```bash
# Clone/Setup
cd backend

# Install all dependencies (including new axios)
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Check health
curl http://localhost:5000/api/health
```

---

## 🔑 Environment Variables Quick Ref

```env
# Required
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk_or_xxx
MONGODB_URI=mongodb://localhost:27017/msme_compliance
JWT_SECRET=your_secret

# Optional but Recommended
OPENROUTER_MODEL=gpt-3.5-turbo
MONGODB_DATABASE=msme_compliance
NODE_ENV=development
PORT=5000
```

---

## 🤖 Using AI Provider

### Import
```javascript
const aiProvider = require('./services/aiProvider');
```

### Generate Answer
```javascript
const response = await aiProvider.generateComplianceAnswer(
  context,      // Your data object
  question,     // User's question string
  language      // Language code: 'en', 'hi', 'hinglish', etc.
);

// Returns:
{
  answer: "...",
  businessMeaning: "...",
  recommendedAction: "...",
  sources: [...]
}
```

### Check Provider Health
```javascript
const status = await aiProvider.checkAIProvider();

// Returns:
{
  status: 'ok',
  provider: 'openrouter',
  providers: {
    available: ['openrouter', 'nvidia-grok', 'google'],
    configured: ['openrouter'],
    active: 'openrouter'
  }
}
```

### Get Available Providers
```javascript
const providers = aiProvider.getAvailableProviders();

// Returns info about all providers
console.log(providers.configured);  // Configured providers
console.log(providers.active);      // Currently active provider
```

---

## 📝 API Endpoints

### Health Check
```bash
GET /api/health
Response: {"status":"ok"}
```

### Assistant (Main AI Endpoint)
```bash
POST /api/assistant
Body: {
  context: {...},
  question: "string",
  language: "en"
}
Response: {
  answer: "...",
  businessMeaning: "...",
  recommendedAction: "...",
  sources: [...]
}
```

---

## 🗄️ MongoDB Models Available

```javascript
// Import models
const User = require('./models/User');
const Business = require('./models/Business');
const Obligation = require('./models/Obligation');
const ComplianceRule = require('./models/ComplianceRule');
const Evidence = require('./models/Evidence');
const RiskHistory = require('./models/RiskHistory');
const AuditLog = require('./models/AuditLog');
// ... and more

// Use them
const user = await User.findById(userId);
const business = await Business.create({name: '...'});
const obligations = await Obligation.find({businessId: id});
```

---

## 📊 Supported Languages

```javascript
const languages = {
  'en': 'English',
  'hi': 'Hindi (देवनागरी लिपि)',
  'hinglish': 'Hinglish (Hindi+English)',
  'as': 'Assamese',
  'bn': 'Bengali',
  'gu': 'Gujarati',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'or': 'Odia',
  'pa': 'Punjabi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ur': 'Urdu',
  // ... and more (22+ total)
};

// Use in API call
await aiProvider.generateComplianceAnswer(context, question, 'hi');
```

---

## 🔄 AI Provider Selection

**No code changes needed!** Just update `.env`:

```bash
# To use OpenRouter
AI_PROVIDER=openrouter

# To use NVIDIA Grok
AI_PROVIDER=nvidia-grok

# To use Google Gemini
AI_PROVIDER=google
```

Then restart server. That's it!

---

## 🧪 Testing AI Provider

### Manual Test
```bash
# Start server
npm run dev

# In another terminal, send test request
curl -X POST http://localhost:5000/api/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "rule": "GST Registration",
      "description": "Business must register for GST if turnover > 40 lakhs"
    },
    "question": "Do I need GST registration?",
    "language": "en"
  }'
```

### In Code Test
```javascript
const aiProvider = require('./services/aiProvider');

async function testAI() {
  try {
    const response = await aiProvider.generateComplianceAnswer(
      {rule: 'Test', description: 'Test rule'},
      'What is this?',
      'en'
    );
    console.log('Success:', response);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAI();
```

---

## 🐛 Debugging Tips

### Check Logs
```bash
# Look for these messages:
# ✓ [AI] Using OpenRouter with model: ...
# ✓ MongoDB connected
# ✓ Server running on port 5000
# ✓ No error messages
```

### Debug AI Provider
```javascript
// Add this to index.js
app.get('/api/ai-status', async (req, res) => {
  const aiProvider = require('./services/aiProvider');
  const status = await aiProvider.checkAIProvider();
  res.json(status);
});

// Then test
curl http://localhost:5000/api/ai-status
```

### Check Database
```bash
# Connect to MongoDB
mongosh

# List databases
show dbs

# Switch to app database
use msme_compliance

# List collections
show collections

# Check documents
db.users.find()
```

---

## 🔐 Environment Variable Validation

**The app validates on startup:**
```
✅ If AI_PROVIDER=openrouter
   └─ Requires: OPENROUTER_API_KEY

✅ If AI_PROVIDER=nvidia-grok
   └─ Requires: NVIDIA_GROK_API_KEY

✅ If AI_PROVIDER=google
   └─ Requires: GEMINI_API_KEY

✅ Always requires: MONGODB_URI
```

If missing, app logs error and exits.

---

## 📦 Installed Packages (Relevant)

```javascript
// API & HTTP
const axios = require('axios');  // For API calls to OpenRouter/NVIDIA
const express = require('express');

// Database
const mongoose = require('mongoose');
const mongoMemoryServer = require('mongodb-memory-server');

// Security
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration
require('dotenv').config();  // Loads .env file

// File Upload
const multer = require('multer');

// Middleware
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
```

---

## 🚨 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `OPENROUTER_API_KEY missing` | API key not in .env | Add key to .env |
| `MongoDB connection failed` | MongoDB not running | Start MongoDB or use Atlas |
| `Port 5000 already in use` | Another app using port | Kill process on port 5000 |
| `Cannot find module 'axios'` | Package not installed | Run `npm install` |
| `Invalid response from AI` | Wrong API key or quota | Check API key and account |
| `Token signature invalid` | JWT_SECRET changed | Use same JWT_SECRET |

---

## 💡 Pro Tips

1. **Use MongoDB Atlas for production** - No local install needed
2. **Keep API keys in `.env`** - Never commit to git
3. **Use OpenRouter for flexibility** - 200+ models available
4. **Monitor logs** - Check for errors on startup
5. **Test health endpoint** - `curl http://localhost:5000/api/health`
6. **Use auto in-memory fallback** - Great for testing without MongoDB
7. **Set strong JWT_SECRET** - At least 32 characters in production
8. **Enable CORS carefully** - Use specific domains in production

---

## 🔗 Useful Links

```
Configuration:
  https://openrouter.ai/docs
  https://build.nvidia.com/
  https://makersuite.google.com/

Database:
  https://www.mongodb.com/cloud/atlas
  https://mongoosejs.com/docs/

Framework:
  https://expressjs.com/
  https://nodejs.org/en/docs/

Environment:
  https://www.npmjs.com/package/dotenv
```

---

## 📝 File Structure Reference

```
backend/
├── .env                    ← Your config (DO NOT COMMIT)
├── .env.example            ← Example template
├── package.json            ← Dependencies
├── src/
│   ├── index.js            ← Main server file
│   ├── services/
│   │   └── aiProvider.js   ← AI provider logic (NEW/UPDATED)
│   ├── models/             ← Database models
│   ├── routes/             ← API endpoints
│   ├── controllers/        ← Route handlers
│   └── middleware/         ← Auth, upload, etc.
└── uploads/                ← File uploads
```

---

## 🎯 Development Workflow

```
1. Update .env with API key
2. Run: npm install
3. Run: npm run dev
4. Check logs for errors
5. Test endpoint: curl http://localhost:5000/api/health
6. Make code changes
7. Server auto-reloads (via nodemon)
8. Test your changes
9. Repeat 6-8
```

---

## 📊 Response Format

All API responses follow this format:

```javascript
// Success
{
  answer: "short answer",
  businessMeaning: "what it means for business",
  recommendedAction: "what to do",
  sources: [
    {
      ruleCode: "GST-REG-001",
      act: "GST Act 2017",
      section: "Section 22",
      officialUrl: "https://...",
      lastVerified: "2024-01-01"
    }
  ]
}

// Error
{
  error: "error message"
}
```

---

## ✅ Pre-Deployment Checklist

- [ ] `.env` configured with real API key
- [ ] MONGODB_URI points to production database
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] NODE_ENV=production
- [ ] API_PROVIDER is set to your chosen provider
- [ ] All npm packages installed
- [ ] Health check endpoint working
- [ ] All environment variables set
- [ ] No sensitive data in code
- [ ] Rate limiting enabled
- [ ] CORS configured for your domain
- [ ] Logs monitored
- [ ] Backups configured (MongoDB Atlas)

---

## 🎓 Learning Path

1. **Beginner:** Copy QUICK_START commands
2. **Intermediate:** Read SETUP_GUIDE.md
3. **Advanced:** Study ARCHITECTURE.md
4. **Expert:** Modify aiProvider.js for custom logic

---

**Last Updated:** 2026-08-16  
**Status:** Complete & Ready to Use  

Need help? Check SETUP_GUIDE.md → Troubleshooting
