# content-creation-tool-dcb

AI-powered article generation with competitor research, SEO optimization, and visual assets.

## Project structure

- `app/`, `components/`, `lib/` — Next.js app (generation UI and API)
- `supabase/migrations/` — Database schema migrations

## Setup

1. Copy `.env.example` to `.env.local`
2. Add your API keys (Gemini/OpenAI, Supabase, optional SerpAPI + Cloudflare)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

- **Root Directory:** leave empty (repository root)
- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (default)
- Add environment variables from `.env.example` in the Vercel dashboard
- Do **not** set `DEV_TLS_INSECURE=1` in production
