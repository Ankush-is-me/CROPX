# CROPX
### Intelligence That Grows.

CROPX is a student-designed AI agriculture platform prototype, built for a Social Science project exploring how AI can help farmers identify crop-health problems, understand field conditions, receive agricultural information in their preferred language, and manage information about their farms.

This repository is a complete, deployable prototype — not a mockup. Authentication, real weather data, and Gemini-powered image/chat analysis are functional; a few clearly-labeled features (the farm map, soil interpretation, risk indicators, and the 3D concept page) are explicitly presented as **prototype/conceptual**, per the project's own design rules.

---

## 1. Project purpose

CROPX responds to a real problem identified through survey research: **crop pest and disease damage**, documented in the *Baseline Survey under On-line Pest Monitoring and Advisory Services Project in Vadodara District of Gujarat* (180 farmers, 9 villages, 3 talukas). See the in-app **Research** page (`#/research`) for the full write-up and source citation.

## 2. Features

- **Landing page** — brand, capability overview, data-to-insight flow, "Why CROPX?"
- **Authentication** — register/login/logout backed by serverless functions and signed, httpOnly session cookies. A built-in demo account (`demo@cropx.app` / `CropXDemo123`) keeps a classroom presentation reliable even without live registration.
- **Dashboard** — greeting, feature shortcuts, farm summary, AI-assisted farm health overview, recent activity.
- **My Farm** — add a farm (name, location, total area, unit), add multiple crops with area validation (allocated area can never exceed total farm area), and a proportional top-down farm visualization where each field's size reflects its share of the farm.
- **Crop detail** — health/pest/disease indicators, last scan date, "Analyze This Crop" and "Ask CROPX AI" shortcuts.
- **Crop Analyzer** — drag-and-drop or click-to-upload image, optional context (crop, location, temperature, humidity, rainfall, soil type), three analysis modes (general/pest/disease), and a structured, qualitative AI assessment (never a fabricated accuracy percentage).
- **CROPX AI Assistant** — a structured chat interface (possible causes / what to check / next steps / when to seek expert help), aware of your active farm's context, and responding in your selected language.
- **Weather** — real current conditions + 7-day forecast from Open-Meteo, plus a CROPX Field Insight that *interprets* (never invents) those numbers.
- **Digital Soil Analysis Prototype** — manual NPK/pH entry with a plain-language interpretation, clearly labeled as a prototype (no physical sensor).
- **Research** page — problem identification, AI exploration, and the CROPX innovation design writeup, with a cited primary source.
- **How CROPX Works** — a pseudo-isometric concept visualization of the sensor → AI → advisory flow.
- **Demo Mode** — inside the Crop Analyzer, "Launch Demo" runs a prepared, clearly-labeled example without calling the Gemini API, so a class presentation survives flaky wifi or a used-up quota.
- Responsive across desktop, tablet and mobile; toasts, modals, skeleton/spinner loading states, and empty/error states throughout.

## 3. Technology stack

| Layer | Choice |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (single-page app, hash router) |
| Backend | Vercel Serverless Functions (Node.js, `/api`) |
| AI | Google Gemini API (`gemini-2.5-flash` by default, multimodal) |
| Weather | Open-Meteo (free, no API key, real current + 7-day forecast) |
| Auth | Custom JWT session cookie, `bcryptjs` password hashing, optional Vercel KV for durable user storage |
| Data | Farm/crop records in browser `localStorage`, scoped per signed-in account (see §6) |

No React, no Python, no PHP — as specified.

## 4. Architecture

```
Browser (index.html + js/*.js)
   │
   │  fetch() with credentials: 'include'
   ▼
Vercel Serverless Functions (/api/*.js)
   │
   ├── /api/auth/register, /login, /logout, /me   → bcryptjs + JWT, Vercel KV (or in-memory fallback)
   ├── /api/weather                                 → Open-Meteo (no key required)
   ├── /api/chat                                     → Gemini text generation (auth required)
   └── /api/analyze                                  → Gemini multimodal image analysis (auth required)
```

The Gemini API key is read **only** from `process.env.GEMINI_API_KEY` inside the serverless functions. It is never present in any HTML, CSS, client-side JavaScript, or committed file. `/api/chat` and `/api/analyze` both reject unauthenticated requests and apply basic per-user rate limiting.

## 5. AI image analysis flow

```
User → CROPX frontend → POST /api/analyze (auth'd) → Gemini multimodal model
     → structured JSON (issue, confidence, observations, next steps) → CROPX result UI
```

Gemini is instructed to: report visible symptoms, a possible pest/disease issue, a **qualitative** confidence level (🟢 High / 🟡 Moderate / 🔴 Low — never a numeric accuracy score), observed indicators, recommended checks, cautious next steps, and whether more images are needed. If the image doesn't provide enough evidence, CROPX says so explicitly rather than guessing.

## 6. Data storage — what's real vs. prototype-level

- **User accounts & passwords**: real. Hashed with bcrypt, stored via **Vercel KV** when connected (recommended for any real deployment). If KV isn't connected, accounts fall back to an in-memory store that only lives for a single serverless invocation — fine for local testing, not for production.
- **Farm & crop records**: stored in the browser (`localStorage`), scoped to the signed-in account's id. This keeps the architecture simple for a class prototype, per the "don't overengineer" project guideline. A production version would move this into the same database as user accounts.
- **Chat & analysis history shown on the dashboard** ("Recent Activity") is also local to the browser.

## 7. Security practices implemented

- Gemini API key stored only as a Vercel environment variable; never shipped to the client.
- Session tokens are signed JWTs in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Passwords hashed with bcrypt (never stored or logged in plaintext).
- `/api/chat` and `/api/analyze` require a valid session and apply per-user rate limiting.
- `/api/auth/*` applies per-IP rate limiting against brute-force/spam.
- Image uploads are validated for MIME type (`jpeg`/`png`/`webp`) and size (≤6MB) before ever reaching Gemini.
- Generic, friendly error messages are returned to the client; raw provider errors and stack traces are only logged server-side.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) set in `vercel.json`.

## 8. Local development

```bash
npm install
npm i -g vercel        # if you don't already have the Vercel CLI
cp .env.example .env.local   # then fill in GEMINI_API_KEY and JWT_SECRET
vercel dev
```

`vercel dev` serves both the static frontend and the `/api` serverless functions together, matching production behavior.

## 9. Deployment (GitHub + Vercel)

1. Push this repository to GitHub.
2. In the Vercel dashboard, **Import Project** from that GitHub repo.
3. Under **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` — your Gemini API key (never commit this)
   - `JWT_SECRET` — a long random string (e.g. `openssl rand -base64 48`)
   - Optionally connect the **Vercel KV** integration (Storage tab) so registered accounts persist durably; it will auto-populate `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
4. Deploy. No Python, no local server, and no extra build step are required — this is a static frontend plus serverless functions.

## 10. Environment variables

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET=replace_with_a_long_random_string
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Never commit a real key. `.env.example` above is illustrative only.

## 11. Project structure

```
CROPX/
├── index.html
├── css/style.css
├── js/
│   ├── app.js         # router, toasts, modals, landing/research/concept views
│   ├── auth.js         # login/register/logout, session state
│   ├── farm.js          # farm & crop data, allocation math, dashboard/farm/soil views
│   ├── analyzer.js       # Crop Analyzer UI + Demo Mode
│   ├── weather.js         # weather view + API client
│   └── assistant.js        # CROPX AI chat UI
├── api/
│   ├── _lib/                # shared server-only helpers (auth, users, rate limiting)
│   ├── auth/                # register.js, login.js, logout.js, me.js
│   ├── chat.js               # Gemini text chat (auth required)
│   ├── analyze.js             # Gemini image analysis (auth required)
│   └── weather.js              # Open-Meteo proxy
├── assets/
│   ├── favicon.svg
│   └── demo/cotton-demo.svg     # original illustrated Demo Mode image
├── package.json
├── vercel.json
└── .env.example
```

## 12. School project alignment

- **Step 1 — Problem Identification**: Research page, §1.
- **Step 2 — AI Exploration**: Research page, §2.
- **Step 3 — Innovation Design Challenge**: Research page, §4 (problem, solution, technology, benefits).
- **Step 4 — Model Creation**: this website is the working digital prototype.

## 13. Important disclaimer

CROPX provides AI-assisted information and does not replace professional agricultural diagnosis. It is a student prototype and is not a scientifically validated agricultural diagnostic system.
