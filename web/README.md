# Content Creator Web App

AI-powered article generation with competitor research, SEO optimization, and visual assets.

## Setup

1. Copy `.env.example` to `.env.local`
2. Add your API keys:
   - `GOOGLE_GEMINI_API` or `GEMINI_API_KEY` (required)
   - `OPENAI_API_KEY` (required)
   - `SERPAPI_KEY` (optional, for competitor research)
   - `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (optional, for scraping)

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Form**: Main topic, keyword, search keywords, language, output format (Markdown/HTML)
- **Optional sitemap**: For internal linking when you have a sitemap URL
- **Pipeline**: Competitor research → Outline → Content → Images → Meta
- **Export**: Download as DOC, MD, or Print to PDF

Generation takes 3–5 minutes. The API route has a 5‑minute timeout (configurable on Vercel Pro).
