# 🚀 LeadDial CRM — Complete Deployment Guide
## (Copy-Paste Ready — Sab Kuch Already Filled Hai)

---

## ✅ STEP 0 — Pehle Yeh Install Karo (One Time Only)

### Node.js Install karo:
1. Jao: **https://nodejs.org**
2. **"LTS"** wala green button click karo
3. Download hoga → Install karo (Next Next Finish)
4. Done ✅

### Git Install karo:
1. Jao: **https://git-scm.com/downloads**
2. Apna OS select karo (Windows/Mac)
3. Download → Install karo (sab default rehne do, Next Next Finish)
4. Done ✅

---

## ✅ STEP 1 — Database Setup (Supabase)

1. Yeh link kholo browser mein:
   👉 **https://supabase.com/dashboard/project/gwvnxhqaeiswdfkpzbtu/sql/new**

2. Agar login maange toh **https://supabase.com** pe account banao → phir woh link dobara kholo

3. Page pe ek bada text box dikhega **(SQL Editor)**

4. Us text box mein **SETUP_DATABASE.sql** file ka saara content paste karo
   - Zip mein se `SETUP_DATABASE.sql` file Notepad mein kholo
   - **Ctrl+A** → **Ctrl+C** (sab select karke copy)
   - SQL Editor mein **Ctrl+V** (paste)

5. **"Run"** button dabao (ya **Ctrl+Enter**)

6. Neeche **"Success. No rows returned"** message aayega ✅

> ⚠️ Agar koi error aaye jo "already exists" bole — ignore karo, sab theek hai

---

## ✅ STEP 2 — GitHub Account Banao & Code Upload Karo

### 2A — GitHub Account:
1. Jao: **https://github.com/signup**
2. Email, Password, Username choose karo → Account ban jaayega

### 2B — New Repository Banao:
1. Login ke baad jao: **https://github.com/new**
2. **Repository name:** `leaddial-crm`
3. **Private** select karo (taaki code private rahe)
4. **"Create repository"** click karo

### 2C — Zip Extract Karo:
1. Download ki hui **leaddial-crm.zip** file pe **Right Click**
2. **"Extract All"** → koi bhi folder choose karo → **Extract**
3. Ek folder milega `crm_output` naam ka

### 2D — Code Upload Karo:
1. **Windows:** Us `crm_output` folder ke andar jao → Address bar pe click karo → type karo `cmd` → Enter dabao
   **Mac:** Us folder pe right click → "New Terminal at Folder"

2. Ab yeh commands **ek ek karke** copy paste karo aur Enter dabao:

```
git init
```
```
git add .
```
```
git commit -m "LeadDial CRM initial commit"
```
```
git branch -M main
```

3. Ab yeh command mein **SIRF `TUMHARA_GITHUB_USERNAME`** ki jagah apna GitHub username daalo:
```
git remote add origin https://github.com/TUMHARA_GITHUB_USERNAME/leaddial-crm.git
```

4. Phir yeh:
```
git push -u origin main
```

5. GitHub username aur password maangega → daalo
   > ⚠️ Password ki jagah **Personal Access Token** chahiye. Banao yahan:
   > **https://github.com/settings/tokens/new**
   > - Note: `deploy`
   > - Expiration: `90 days`
   > - Scope: ✅ `repo` pe tick karo
   > - **Generate token** → jo code milega woh copy karo → password mein paste karo

---

## ✅ STEP 3 — Vercel pe Deploy Karo (Free Hosting)

### 3A — Vercel Account:
1. Jao: **https://vercel.com/signup**
2. **"Continue with GitHub"** click karo → GitHub se login karo

### 3B — Project Import:
1. Jao: **https://vercel.com/new**
2. `leaddial-crm` repo dikhega → uske saamne **"Import"** click karo

### 3C — Environment Variables Add Karo:
**"Environment Variables"** section mein neeche scroll karo — yeh **3 variables** ek ek karke add karo:

---

**Variable 1:**
- **Name:** `VITE_SUPABASE_URL`
- **Value:**
```
https://gwvnxhqaeiswdfkpzbtu.supabase.co
```
→ **Add** click karo

---

**Variable 2:**
- **Name:** `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dm54aHFhZWlzd2Rma3B6YnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzE0NjksImV4cCI6MjA5MTk0NzQ2OX0.1xfjp6du_gEP63wJqb6mFHjz4C9O7Yi3NR3dTuPyd-0
```
→ **Add** click karo

---

### 3D — Deploy:
1. **"Deploy"** button dabao
2. **2-3 minute** wait karo — building hoga
3. ✅ **"Congratulations!"** screen aayegi
4. Tumhara live URL milega — kuch aisa:
   👉 `https://leaddial-crm-XXXX.vercel.app`

---

## ✅ STEP 4 — Pehla Admin Account Banao

### 4A — App mein Sign Up:
1. Apna Vercel URL kholo
2. **"Sign Up"** tab click karo
3. Apna **Full Name, Email, Password** daalo → **"Create Agent Account"**
4. Email confirm karo (inbox check karo — Supabase ka email aayega → link click karo)

### 4B — Admin Role Do:
1. Yeh link kholo:
   👉 **https://supabase.com/dashboard/project/gwvnxhqaeiswdfkpzbtu/editor**
2. Left mein **`user_roles`** table pe click karo
3. Tumhara row dikhega — `role` column mein `agent` likha hoga
4. Us cell pe **double click** karo → `agent` delete karo → `admin` type karo → **Enter**
5. Save ✅

### 4C — Admin se Login karo:
1. App mein **Sign Out** karo
2. Dobara **Sign In** karo
3. 🎉 **Admin Dashboard** dikhega!

---

## ✅ STEP 5 — Phone Pe Install Karo (PWA)

### Android (Chrome):
1. Chrome mein apna Vercel URL kholo
2. Top right **3 dots (⋮)** → **"Add to Home Screen"**
3. **"Add"** → Done ✅
4. Home screen pe **LeadDial** icon aa jaayega

### iPhone (Safari):
1. **Safari** mein Vercel URL kholo (Chrome pe kaam nahi karega)
2. Neeche **Share button (□↑)** → **"Add to Home Screen"**
3. **"Add"** → Done ✅

---

## ✅ STEP 6 — Agents Ke Liye Accounts Banana

Har agent ke liye:
1. Agent ko Vercel URL do
2. Agent **Sign Up** kare — automatically Agent account ban jaata hai
3. Admin portal mein **User Management** → agent activate karo

---

## 📱 App Use Kaise Karein — Agent Flow

```
1. App kholo → Sign In
2. "Get Next Lead" button dabao
3. Lead details dikhengi (business name, phone, rating etc.)
4. "Start Call — 9876543210" button dabao
   → Phone ka dialer khulega
   → Background mein recording silently start ho jaayegi
5. Speakerphone pe call karo
6. Call khatam → App pe wapis aao
7. Disposition select karo:
   Interested / Not Interested / Follow Up / Busy / etc.
8. Recording automatically Telegram pe upload ho jaayegi ✅
```

---

## 📊 Telegram Recordings Kahan Aayengi

Group name: **SnapWebDev Call Recordings**
Har recording mein yeh info hogi:
- Agent ka naam
- Lead ka naam
- Call duration
- Date & time

---

## 🆘 Common Problems & Solutions

| Problem | Solution |
|---|---|
| `npm: command not found` | Node.js dobara install karo — Step 0 |
| `git: command not found` | Git dobara install karo — Step 0 |
| `remote: Repository not found` | GitHub username check karo — Step 2D |
| Build failed on Vercel | Environment variables check karo — Step 3C |
| Login nahi ho raha | Email confirm ki? Inbox check karo |
| Recording nahi ho rahi | Mic permission allow karo — browser mein 🔒 icon |
| Telegram pe recording nahi aayi | Internet check karo, dobara dispose karo |

---

## 🔐 Zaroori Credentials (Save Karke Rakho)

```
Supabase Project URL:
https://gwvnxhqaeiswdfkpzbtu.supabase.co

Supabase Anon Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dm54aHFhZWlzd2Rma3B6YnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzE0NjksImV4cCI6MjA5MTk0NzQ2OX0.1xfjp6du_gEP63wJqb6mFHjz4C9O7Yi3NR3dTuPyd-0

Telegram Bot Token:
8218115226:AAHG-HB8iSpp8Sh31T5SW0skPFvglFXPsrU

Telegram Chat ID:
-1003988405811

Supabase Dashboard:
https://supabase.com/dashboard/project/gwvnxhqaeiswdfkpzbtu
```

---

*Total time: ~30 minutes | Difficulty: Easy*
