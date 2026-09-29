# Flag Forge

Realtime 24/7 YouTube Live Interactive Country Flag Battle with Procedural Lo-Fi Music & AI Simulation Mode. Built with **Next.js (App Router)**, **Colyseus WebSocket Server**, **PixiJS Canvas**, and **Tone.js**.

---

## Features

- **Autonomous AI Simulation (Anti-Dead Air)**: bot flags spawn automatically when chat is quiet so the screen stays alive.
- **4-Tier Live Chat Ingestion** (`src/services/youtube.ts`):
  - *Tier 1*: YouTube Official Data API v3.
  - *Tier 2*: Zero-Quota Innertube Web Scraper (auto-switch on API quota errors).
  - *Tier 3*: Emergency Mock Chat Simulator (no credentials / repeated failures).
  - Note: mock chat emits are tagged `isFallbackMock`; the game engine spawns them but keeps them out of the `lastUserChatTime` activity window, so simulator traffic never suppresses real viewers or pollutes player stats.
- **Lo-Fi Procedural Audio Engine (76 BPM)** (`src/lib/audio/index.ts`):
  - Lo-Fi Jazz chord loop (Dm9 → G13 → Cmaj9 → Am7) with warm filter/reverb/chorus.
  - Country-based pentatonic spawn/hit SFX for 8 mapped countries (`ID/US/JP/KR/BR/FR/DE/GB`), generic fallback otherwise. SFX trigger immediately (not beat-quantized).
- **10-Minute Rounds & Leaderboard**: scores reset every 10 minutes with a winner banner celebration.
- **OBS Ready Overlay**: glassmorphism cyber-lofi 1080p transparent design at `/overlay`.
- **AI Flag Chat (optional)**: click a flag to chat with it via OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`). Works without a key — local fallback replies + `offline mode` badge.
- **Rate-Limited Public AI Route** (`src/lib/rateLimit.ts`): `POST /api/chat` is unauthenticated, so it is capped per client via an optional Upstash sliding window. Unset credentials fail open with a warning; over-limit callers get `429` + `Retry-After`.

---

## Running with pnpm

This project uses **pnpm only** (pinned via `packageManager` in `package.json`). Do not use `npm install` or `yarn`.

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Run local server**:
   ```bash
   pnpm dev
   ```
   Useful scripts: `pnpm test` (unit tests), `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`.

3. Open in browser or OBS Browser Source:
   - Overlay: `http://localhost:3000/overlay`
   - Health: `http://localhost:3000/api/health`
   - WebSocket Engine: `ws://localhost:3001`

---

## Environment Configuration (`.env`)

Copy `.env.example` to `.env` and fill in. Only one YouTube option is needed:

### Option A: Zero-Quota mode (recommended for 24/7)
Only your live stream video ID is needed:
```env
YOUTUBE_VIDEO_ID=YOUR_YOUTUBE_VIDEO_ID
PORT=3000
```

### Option B: Official API Key mode
```env
YOUTUBE_API_KEY=YOUR_GCP_API_KEY
YOUTUBE_VIDEO_ID=YOUR_YOUTUBE_VIDEO_ID
PORT=3000
```

### Optional
```env
YOUTUBE_LIVE_CHAT_ID=LIVE_CHAT_ID
YOUTUBE_POLL_INTERVAL_MS=5000
OPENROUTER_API_KEY=YOUR_KEY  # optional: AI flag chat falls back to local replies without it

# Optional: rate limit POST /api/chat (unlimited + a warning log if unset)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CHAT_RATE_LIMIT_MAX=10
CHAT_RATE_LIMIT_WINDOW=1 m
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:3001  # overlay WebSocket URL for production
HOST=localhost
COLYSEUS_PORT=3001
PORT=3000
```

---

## Setup in OBS Studio

1. In OBS Studio, click **Add Source (+)** → **Browser Source**.
2. Enter URL: `http://localhost:3000/overlay`
3. Set Width: `1920`, Height: `1080`.
4. Check **"Control audio via OBS"** (audio starts after first click; browsers block autoplay otherwise).
5. Place animated background / lo-fi video on the bottom layer in OBS.
