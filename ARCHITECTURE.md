# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                      (localhost:3000)                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ API Calls
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js/Express)                  │
│                   (localhost:5000)                           │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Routes & Controllers                       │  │
│  │  - /api/assistant                                     │  │
│  │  - /api/compliance-actions                            │  │
│  │  - /api/risk                                          │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                        │
│                     ↓                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         aiProvider.js (NEW - Multi-AI Support)        │  │
│  │                                                       │  │
│  │  Supports:                                           │  │
│  │  • OpenRouter (200+ models)  ← RECOMMENDED          │  │
│  │  • NVIDIA Grok                                       │  │
│  │  • Google Gemini                                     │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                        │
│         ┌───────────┼───────────┐                          │
│         ↓           ↓           ↓                          │
│    ┌─────────┐  ┌─────────┐  ┌──────────┐                 │
│    │OpenRoute│  │NVIDIA   │  │ Gemini   │                 │
│    │ API     │  │Grok API │  │ API      │                 │
│    └────┬────┘  └────┬────┘  └────┬─────┘                 │
│         │             │            │                       │
│         └──────┬──────┴────────────┘                       │
│                │ AI Response                               │
│                ↓                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Services Layer                               │  │
│  │  - contextBuilder.js                                │  │
│  │  - documentIntelligenceService.js                   │  │
│  │  - reminderService.js                              │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                        │
│                     ↓                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Mongoose Models (Database)                   │  │
│  │  - User, Business, Obligation                       │  │
│  │  - Compliance Rules, Evidence                       │  │
│  │  - Audit Logs, Risk History                         │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                        │
│                     ↓                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              .env Configuration                      │  │
│  │  - MONGODB_URI                                      │  │
│  │  - AI_PROVIDER (openrouter/nvidia-grok/google)    │  │
│  │  - API Keys for each provider                      │  │
│  │  - JWT_SECRET                                      │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ↓
         ┌────────────────────────┐
         │   MongoDB Database      │
         │                        │
         │  Option A: Local       │
         │  localhost:27017       │
         │                        │
         │  Option B: Atlas (Cloud)
         │  mongodb+srv://...     │
         │                        │
         │  Option C: In-Memory   │
         │  (Fallback)            │
         └────────────────────────┘
```

---

## Data Flow: User Question → AI Response

```
User Question
    │
    ↓
┌─────────────────────────────┐
│  Frontend sends to backend  │
│  POST /api/assistant        │
│  {                          │
│    context: {...},          │
│    question: "...",         │
│    language: "en"           │
│  }                          │
└────────┬────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│  aiProvider.js evaluates:   │
│  1. Check AI_PROVIDER env   │
│  2. Validate API key        │
│  3. Build prompt            │
└────────┬────────────────────┘
         │
         ↓
    ┌────────────────────────────┐
    │ Route to correct provider: │
    │                            │
    │ if AI_PROVIDER ==          │
    │   "openrouter"             │
    │      → callOpenRouter()    │
    │   "nvidia-grok"            │
    │      → callNvidiaGrok()    │
    │   "google"                 │
    │      → callGemini()        │
    │                            │
    └────────┬───────────────────┘
             │
             ↓
    ┌────────────────────────────┐
    │  External AI API Call      │
    │  (with axios)              │
    │                            │
    │  Send: Prompt + System     │
    │  Instruction + Language    │
    │                            │
    │  Receive: JSON Response    │
    │                            │
    └────────┬───────────────────┘
             │
             ↓
    ┌────────────────────────────┐
    │  Parse & Validate Response │
    │                            │
    │  Extract:                  │
    │  - answer                  │
    │  - businessMeaning         │
    │  - recommendedAction       │
    │  - sources                 │
    │                            │
    └────────┬───────────────────┘
             │
             ↓
    ┌────────────────────────────┐
    │  Return JSON to Frontend   │
    │                            │
    │  {                         │
    │    answer: "...",          │
    │    businessMeaning: "...", │
    │    recommendedAction: "...",
    │    sources: [...]          │
    │  }                         │
    │                            │
    └────────┬───────────────────┘
             │
             ↓
    ┌────────────────────────────┐
    │  Display in Frontend UI    │
    │                            │
    │  • Show answer             │
    │  • Show sources            │
    │  • Suggest actions         │
    │  • Display in user language│
    │                            │
    └────────────────────────────┘
```

---

## Configuration Priority

```
Environment Variables (.env)
        │
        ├─→ AI_PROVIDER
        │    ├─ "openrouter" (Default)
        │    ├─ "nvidia-grok"
        │    └─ "google"
        │
        ├─→ OPENROUTER_API_KEY
        │    └─ Required if AI_PROVIDER=openrouter
        │
        ├─→ OPENROUTER_MODEL
        │    └─ gpt-3.5-turbo (default)
        │
        ├─→ NVIDIA_GROK_API_KEY
        │    └─ Required if AI_PROVIDER=nvidia-grok
        │
        ├─→ GEMINI_API_KEY
        │    └─ Required if AI_PROVIDER=google
        │
        └─→ MONGODB_URI
             └─ Local or Atlas connection string
```

---

## Database Connection Options

```
┌──────────────────────────────────────────────────┐
│    Try to connect to MONGODB_URI                 │
└─────────────────┬────────────────────────────────┘
                  │
          ┌───────┴───────┐
          │               │
       SUCCESS         FAILURE
          │               │
          ↓               ↓
    ┌──────────┐   ┌─────────────────────────┐
    │Connected │   │Try In-Memory MongoDB    │
    │ to real  │   │(mongodb-memory-server)  │
    │ MongoDB  │   └──────────┬──────────────┘
    │          │              │
    │ Data     │         SUCCESS
    │persists  │              │
    │          │              ↓
    │across    │      ┌───────────────────┐
    │restarts  │      │In-Memory Database │
    │          │      │                   │
    └──────────┘      │Data lost on       │
                      │server restart     │
                      │                   │
                      │Good for:          │
                      │• Testing          │
                      │• Development      │
                      │• Demo             │
                      └───────────────────┘
```

---

## Environment Variables Summary

| Variable | Required | Values | Example |
|----------|----------|--------|---------|
| `AI_PROVIDER` | Yes | openrouter, nvidia-grok, google | `openrouter` |
| `OPENROUTER_API_KEY` | If openrouter | String | `sk_or_abc123...` |
| `OPENROUTER_MODEL` | No | Model name | `gpt-3.5-turbo` |
| `NVIDIA_GROK_API_KEY` | If nvidia-grok | String | `nvapi_abc123...` |
| `GEMINI_API_KEY` | If google | String | `AIzaSy_abc123...` |
| `MONGODB_URI` | Yes | Connection URL | `mongodb://localhost:27017/...` |
| `JWT_SECRET` | Yes | Secret key | `supersecretkey` |
| `PORT` | No | Number | `5000` |
| `NODE_ENV` | No | development, production | `development` |

---

## File Changes Made

```
backend/
├── .env (UPDATED)
│   └── Added AI provider variables
│
├── .env.example (UPDATED)
│   └── Added AI provider examples
│
├── package.json (UPDATED)
│   └── Added: axios
│
└── src/services/
    └── aiProvider.js (COMPLETELY REWRITTEN)
        ├── callOpenRouter()
        ├── callNvidiaGrok()
        ├── callGemini()
        ├── generateComplianceAnswer() [main export]
        ├── getAvailableProviders()
        └── checkAIProvider()
```

---

## Testing Checklist

```
Setup:
  □ Created OpenRouter account
  □ Generated API key
  □ Added to .env

Installation:
  □ Ran: npm install (in backend folder)
  □ Axios package installed

Running:
  □ Started backend: npm run dev
  □ Port 5000 accessible

Verification:
  □ GET /api/health returns {"status":"ok"}
  □ MongoDB connected (check logs)
  □ AI provider initialized (check logs)

Testing AI:
  □ Make test POST to /api/assistant
  □ Receives JSON response
  □ Response has: answer, businessMeaning, sources
```

---

Generated: 2026-08-16
Last Updated: See this file's modification date
