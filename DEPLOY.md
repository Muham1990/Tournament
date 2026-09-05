# Deploy: Vercel + Railway + Neon

Local site: `npm run db:start` then `npm run dev`  
- Web: https://localhost:5173  
- API: http://localhost:5000

## 1. Neon (database)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (pooled is fine for the app).
3. Add `?sslmode=require` if it is not already there.

## 2. Railway (backend)

1. New project → Deploy from GitHub (this repo).
2. Use the repo root. `railway.toml` already has build/start.
3. Variables:

```
DATABASE_URL=          # from Neon
JWT_SECRET=            # long random string
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_GATE=
NODE_ENV=production
CLIENT_URL=            # https://your-app.vercel.app  (set after Vercel)
CLIENT_URLS=           # optional extra Vercel URLs
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=   # same as CLIENT_URL after the site is live
TELEGRAM_ADMIN_CHAT_ID=
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
UPLOAD_DIR=./uploads
```

4. After the first deploy, copy the public Railway URL (`https://….up.railway.app`).
5. Open `/api/health` — should return `{"ok":true}`.

Photos live on the Railway disk and disappear on redeploy unless you add a volume and point `UPLOAD_DIR` at it.

## 3. Vercel (frontend)

1. New project → this repo. **Root Directory: leave empty** (monorepo root).
2. Framework: Vite. `vercel.json` sets install/build/output.
3. Environment variable (Production **and** Preview):

```
VITE_API_URL=https://your-api.up.railway.app
```

No trailing slash. Rebuild after changing this value.

4. Copy the Vercel URL into Railway `CLIENT_URL` (and `TELEGRAM_WEBAPP_URL`). Redeploy Railway.

## 4. Telegram Mini App

Set BotFather Web App URL and Railway `TELEGRAM_WEBAPP_URL` to the **Vercel HTTPS** URL.

## First admin login

Open `https://your-app.vercel.app/a/<ADMIN_GATE>` then log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
