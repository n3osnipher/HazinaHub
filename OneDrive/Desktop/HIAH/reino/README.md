# Reino Daily Task Assistant v2.1

AI-powered communications platform. **Hiah** manages your calls, SMS, and contacts across Safaricom and Airtel SIM cards.

## Bug Fixes in v2.1
- Fixed `KeyError: '"contact"'` in Hiah service — curly braces in SYSTEM_PROMPT caused `.format()` failure. Fixed by building prompt as plain string concatenation.
- Hiah now receives contacts, messages, calls, notifications as full context on every request.
- Smart contact disambiguation (multiple "Johns" → asks which one).
- Hiah reads messages, calls, and notifications aloud.
- Settings hides API key values.
- User profile photo accessible from topbar.
- Full mobile-responsive layout with bottom nav bar.

## Quick Start

### Backend
```bash
cd reino/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set MONGODB_URL + JWT_SECRET
python main.py         # http://localhost:8000
```

### Frontend
```bash
cd reino/frontend
npm install && npm run dev   # http://localhost:3000
```

## Deploy to Render + Vercel

### Backend → Render
1. Push backend/ to GitHub
2. Render: New Web Service → connect repo
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Env vars: MONGODB_URL, JWT_SECRET, ALLOWED_ORIGINS (your Vercel URL)

### Frontend → Vercel
1. Push frontend/ to GitHub
2. Vercel: New Project → import repo
3. Add env var: VITE_API_URL = https://your-render-url.onrender.com
4. In src/services/api.ts change baseURL to: `import.meta.env.VITE_API_URL || '/api'`

## Build APK (Capacitor)
```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap sync android
npx cap open android   # Build APK in Android Studio
# OR: cd android && ./gradlew assembleDebug
```

## Hiah Commands
- "Call Mama" → looks up + confirms + dials
- "Call John" (multiple) → disambiguates, asks which John
- "Send SMS to Grace: On my way" → confirms + sends
- "Read my messages" → reads unread SMS aloud
- "Any missed calls?" → reports with timestamps
- "My notifications" → reads all unread alerts
- "My SIM cards" → shows detected SIMs
- "WhatsApp someone" → explains not supported, offers SMS

## Environment Variables (Backend)
- MONGODB_URL (required)
- JWT_SECRET (required)
- GEMINI_API_KEY (optional — users can set their own in Settings)
- ELEVENLABS_API_KEY (optional)
- ALLOWED_ORIGINS (required in production)
