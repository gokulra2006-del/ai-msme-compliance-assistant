# Quick API Setup Commands

## 1️⃣ Get API Keys (5 minutes)

### OpenRouter (Recommended)
```bash
# 1. Visit: https://openrouter.ai/
# 2. Sign up
# 3. Go to Dashboard → Settings → API Keys
# 4. Create new key
# 5. Copy and paste in .env
```

### NVIDIA Grok (Alternative)
```bash
# 1. Visit: https://build.nvidia.com/
# 2. Sign up
# 3. Create API Key
# 4. Copy and paste in .env
```

---

## 2️⃣ Update `.env` File

**Edit: `backend/.env`**

Replace this:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/msme_compliance
JWT_SECRET=supersecretkey
```

With this:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/msme_compliance
JWT_SECRET=supersecretkey

# 🤖 AI Configuration
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk_or_YOUR_KEY_HERE
OPENROUTER_MODEL=gpt-3.5-turbo

# 🗄️ Database
MONGODB_DATABASE=msme_compliance
NODE_ENV=development
```

---

## 3️⃣ Install & Run

```bash
# Go to backend folder
cd backend

# Install new package (axios for API calls)
npm install axios

# Start server
npm run dev
```

---

## 4️⃣ Verify Setup

```bash
# Check if running
curl http://localhost:5000/api/health
```

Expected:
```json
{"status":"ok"}
```

---

## MongoDB Options (Pick One)

### Option A: Local MongoDB (Quickest)
```bash
# Already works with fallback to in-memory DB
# No action needed unless you want persistence
```

### Option B: MongoDB Atlas (Recommended for Production)

1. Go to: https://www.mongodb.com/cloud/atlas
2. Create account
3. Create free cluster (M0 Sandbox)
4. Get connection string
5. Update `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/msme_compliance
```

---

## AI Provider Comparison

| Feature | OpenRouter | NVIDIA Grok | Google Gemini |
|---------|-----------|------------|---------------|
| **Cost** | $$ | $$ | $ |
| **Models** | 200+ | 1 | 3 |
| **Speed** | Fast | Fast | Medium |
| **Ease** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Best For** | Production | Enterprise | Development |

---

## What Was Added

✅ **API Provider Support:**
- OpenRouter (200+ models)
- NVIDIA Grok
- Google Gemini

✅ **Environment Variables:**
- AI_PROVIDER selection
- API keys for each provider
- MongoDB configuration

✅ **Code Changes:**
- `backend/src/services/aiProvider.js` - Multi-provider support
- `backend/package.json` - Added axios
- `backend/.env` - New variables

✅ **Documentation:**
- This quick guide
- Full SETUP_GUIDE.md

---

## Done! 🎉

Your app now supports:
1. Multiple AI providers
2. Easy API key configuration
3. MongoDB (local or cloud)
4. Production-ready setup

Start coding! 🚀
