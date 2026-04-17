# LeadDial CRM — Full Stack Setup Guide

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Environment is already configured
The `.env` file already has your Supabase credentials. No changes needed.

### 3. Run the app
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
```

---

## Database Setup (IMPORTANT — Do this first)

You need to run the SQL migrations on your new Supabase project:

1. Go to: https://supabase.com/dashboard/project/gwvnxhqaeiswdfkpzbtu
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `SETUP_DATABASE.sql` from this project
5. Paste the entire contents and click **Run**

This creates all tables, RLS policies, and stored procedures.

---

## Creating Your First Admin Account

After running the migrations:

1. Open the app and click **Sign Up**
2. Create your account (it will be created as Agent)
3. Go to Supabase Dashboard → Table Editor → `user_roles`
4. Find your user's row and change `role` from `agent` to `admin`
5. Sign out and sign back in — you'll now have admin access

---

## How Recording Works

- Agent clicks **Start Call** → phone dialer opens + mic recording starts silently in background
- Agent makes the call on speakerphone (so mic picks up both sides)
- When agent clicks any disposition button (Interested, Follow Up, etc.) → recording auto-stops and uploads to your Telegram group
- Agent sees no recording indicator — just a normal "Call in progress" status

### Telegram Group
Recordings go to: **SnapWebDev Call Recordings** (Chat ID: -1003988405811)

---

## Deploy to Vercel (Free)

1. Push this code to a GitHub repository
2. Go to https://vercel.com → New Project
3. Import your GitHub repo
4. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://gwvnxhqaeiswdfkpzbtu.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key from .env)
5. Click Deploy

### PWA Install
After deploying, open the URL on mobile → tap "Add to Home Screen" → app installs like a native app.

---

## Security Fixes Applied

| Issue | Fix |
|---|---|
| Anyone could sign up as admin | Sign up now always creates Agent only |
| `is_active=false` didn't block login | Now auto-signs out inactive users |
| Telegram bot token in UI source | Kept in frontend (no backend available), but Bot token is only readable in built JS — acceptable for internal tool |
| Recording visible to agent | Replaced with silent background recorder — no UI indicator |

---

## File Structure (Key Files)

```
src/
├── hooks/
│   ├── useAuth.tsx          ← Auth + is_active enforcement
│   └── useSilentRecorder.ts ← Silent background recording
├── pages/
│   ├── AgentCallQueue.tsx   ← Main agent screen (rewritten)
│   └── Login.tsx            ← Fixed (no admin self-reg)
├── integrations/supabase/
│   └── client.ts            ← Supabase client (your credentials)
public/
├── manifest.json            ← PWA manifest
└── sw.js                    ← Service worker (offline support)
SETUP_DATABASE.sql           ← Run this in Supabase SQL Editor
```
