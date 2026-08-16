# MSME Compliance Assistant - Setup Guide

Complete step-by-step guide to configure API keys and MongoDB connection.

---

## 📋 Table of Contents
1. [AI Provider Setup](#ai-provider-setup)
2. [MongoDB Connection](#mongodb-connection)
3. [Environment Configuration](#environment-configuration)
4. [Installation & Running](#installation--running)
5. [Testing](#testing)

---

## 🤖 AI Provider Setup

### Option 1: OpenRouter (RECOMMENDED)

**Why OpenRouter?**
- ✅ Supports 200+ models (GPT-4, Claude, Mistral, etc.)
- ✅ Simple unified API
- ✅ Good pricing and flexibility
- ✅ No rate limits per model
- ✅ Best for production

**Steps:**

1. **Sign up for OpenRouter**
   - Go to: https://openrouter.ai/
   - Create an account
   - Verify email

2. **Generate API Key**
   - Login to OpenRouter Dashboard
   - Navigate to: Settings → API Keys
   - Click "Create New Key"
   - Copy the key (keep it safe!)

3. **Choose Your Model**
   - Examples: `gpt-3.5-turbo`, `gpt-4`, `claude-3-opus`, `mistral-7b-instruct`
   - View all models: https://openrouter.ai/models
   - Default: `gpt-3.5-turbo`

4. **Update `.env` file**
   ```
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=sk_or_xxxxxxxxxxxxx
   OPENROUTER_MODEL=gpt-3.5-turbo
   ```

---

### Option 2: NVIDIA Grok

**When to use?**
- Enterprise customers
- Need direct Grok access
- NVIDIA ecosystem users

**Steps:**

1. **Sign up for NVIDIA Build**
   - Go to: https://build.nvidia.com/
   - Create account
   - Verify email

2. **Generate API Key**
   - Dashboard → API Keys
   - Create new key
   - Copy it

3. **Update `.env` file**
   ```
   AI_PROVIDER=nvidia-grok
   NVIDIA_GROK_API_KEY=nvapi-xxxxxxxxxxxxx
   ```

---

### Option 3: Google Gemini (Fallback)

**Steps:**

1. **Get API Key**
   - Go to: https://makersuite.google.com/app/apikey
   - Create new key
   - Copy it

2. **Update `.env` file**
   ```
   AI_PROVIDER=google
   GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxx
   ```

---

## 🗄️ MongoDB Connection

MongoDB is already configured with fallback to in-memory server. Choose your setup:

### Option A: Local MongoDB (Development)

**Requirements:** MongoDB installed locally

**Steps:**

1. **Install MongoDB Community** (if not already installed)
   - Windows: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/
   - macOS: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-macos/
   - Linux: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

2. **Start MongoDB Service**
   ```bash
   # Windows
   net start MongoDB
   
   # macOS (with Homebrew)
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

3. **Verify Connection**
   ```bash
   mongosh
   > db.version()  # Should return version number
   > exit
   ```

4. **Update `.env`**
   ```
   MONGODB_URI=mongodb://localhost:27017/msme_compliance
   MONGODB_DATABASE=msme_compliance
   ```

---

### Option B: MongoDB Atlas (Cloud - Recommended for Production)

**Benefits:** 
- No local installation
- Automatic backups
- Scalable
- Free tier available

**Steps:**

1. **Create Account**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Sign up (free)
   - Verify email

2. **Create Cluster**
   - Click "Create Deployment"
   - Select "M0 Sandbox" (free tier)
   - Choose region (recommend India: Mumbai)
   - Click "Create"

3. **Setup Security**
   - Go to "Security Quickstart"
   - Create database user
   - Username: `msme_admin`
   - Auto-generate password (copy it!)
   - Add IP address: `0.0.0.0/0` (allow all - for development)
   - For production: Use your server IP only

4. **Get Connection String**
   - Click "Connect" button
   - Choose "Drivers" (Node.js)
   - Copy connection string
   - Replace `<username>` and `<password>`
   - Example: `mongodb+srv://msme_admin:password@cluster.mongodb.net/msme_compliance`

5. **Update `.env`**
   ```
   MONGODB_URI=mongodb+srv://msme_admin:your_password@cluster.mongodb.net/msme_compliance
   MONGODB_DATABASE=msme_compliance
   ```

---

### Option C: Automatic Fallback (Easiest)

**Default Behavior:**
- If `MONGODB_URI` fails → Uses in-memory MongoDB
- Data persists during session only
- Perfect for testing & development

**Just leave as is:**
```
MONGODB_URI=mongodb://localhost:27017/msme_compliance
```

If local MongoDB isn't running, app will auto-fallback to in-memory.

---

## 📝 Environment Configuration

### Complete `.env` Template

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/msme_compliance
MONGODB_DATABASE=msme_compliance

# Authentication
JWT_SECRET=your_super_secret_key_change_this_in_production

# AI Provider: openrouter | nvidia-grok | google
AI_PROVIDER=openrouter

# OpenRouter (Recommended)
OPENROUTER_API_KEY=sk_or_xxxxxxxxxxxxx
OPENROUTER_MODEL=gpt-3.5-turbo

# NVIDIA Grok (Optional)
NVIDIA_GROK_API_KEY=nvapi-xxxxxxxxxxxxx

# Google Gemini (Optional)
GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxx
```

---

## ⚙️ Installation & Running

### 1. Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `axios` - For API calls to OpenRouter/NVIDIA
- `express` - Web framework
- `mongoose` - MongoDB connection
- `dotenv` - Environment variables
- Plus all other dependencies

### 2. Run Backend

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### 3. Check if Running

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{"status": "ok"}
```

---

## 🧪 Testing

### Test AI Provider

Once backend is running:

```bash
curl -X GET http://localhost:5000/api/health
```

To test in code, add this endpoint to `src/index.js`:

```javascript
app.get('/api/ai-status', async (req, res) => {
  const aiProvider = require('./services/aiProvider');
  const status = await aiProvider.checkAIProvider();
  res.json(status);
});
```

Then test:
```bash
curl http://localhost:5000/api/ai-status
```

### Test MongoDB

```bash
# In your terminal
mongosh

# Or in your backend code
const mongoose = require('mongoose');
console.log(mongoose.connection.readyState); // 1 = connected
```

### Test API Call

Example JavaScript to test AI:

```javascript
const response = await fetch('http://localhost:5000/api/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: { rule: 'Test rule' },
    question: 'What does this mean?',
    language: 'en'
  })
});

const data = await response.json();
console.log(data);
```

---

## 🔧 Troubleshooting

### Issue: "OPENROUTER_API_KEY missing"
**Solution:** Add API key to `.env` and restart server

### Issue: "MongoDB connection failed"
**Solution:** 
1. Check if MongoDB is running: `mongosh`
2. Or use MongoDB Atlas (cloud version)
3. App will auto-fallback to in-memory DB

### Issue: "Invalid response from AI provider"
**Solution:**
1. Check API key is correct
2. Check model name is valid
3. Check your API account has credits/usage available

### Issue: Port 5000 already in use
**Solution:** 
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :5000
kill -9 <pid>
```

---

## 📊 Recommended Setup for Production

```env
# Use OpenRouter for best reliability
AI_PROVIDER=openrouter
OPENROUTER_MODEL=gpt-4  # For better quality

# Use MongoDB Atlas with strong password
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/msme_compliance

# Strong JWT secret (256-bit recommended)
JWT_SECRET=your_long_random_string_min_32_characters_here

# Security
NODE_ENV=production
```

---

## 📚 Useful Links

- **OpenRouter Docs:** https://openrouter.ai/docs
- **MongoDB Atlas:** https://www.mongodb.com/cloud/atlas
- **Mongoose Docs:** https://mongoosejs.com
- **Express Docs:** https://expressjs.com

---

## ✅ Quick Checklist

- [ ] Created OpenRouter account & API key
- [ ] Updated `.env` with AI_PROVIDER
- [ ] Updated `.env` with OPENROUTER_API_KEY
- [ ] Installed MongoDB or MongoDB Atlas
- [ ] Updated MONGODB_URI in `.env`
- [ ] Ran `npm install` in backend folder
- [ ] Started backend with `npm run dev`
- [ ] Verified health endpoint works
- [ ] Tested AI provider with test API call

---

Need help? Check `/memories/session/setup_guide.md` for quick reference.
