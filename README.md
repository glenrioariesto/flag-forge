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
- **One-command Cloud Deploy** (`deploy/`): Docker + Caddy + systemd on an Oracle Cloud Always-Free VM, with CI gated on a green build and a post-deploy health check.
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

## Deploy (Oracle Cloud Always-Free)

Target: the **4 OCPU / 24 GB ARM Ampere A1** free shape. GCP's free tier (2 vCPU / 1 GB) is a poor fit here — this app runs a persistent custom server that hosts *both* Next.js and a Colyseus WebSocket engine, so it needs a long-lived process with memory headroom, not a serverless function.

### One-time VM setup

On a fresh Ubuntu 24.04 instance, as root:

```bash
sudo bash deploy/bootstrap-vm.sh
```

This installs Docker (with log rotation so the 200 GB volume does not fill), adds 2 GB of swap, enables unattended security upgrades, installs `flag-forge.service` so the stack survives a reboot, and clones the repo into `/opt/flag-forge`.

Then, before your first deploy:

1. Edit the hostnames in `deploy/Caddyfile` (it ships with `example.com` placeholders) and point both DNS A records at the VM.
2. Open TCP `22`, `80`, `443` in the OCI security list.
3. Create `/opt/flag-forge/.env` from `.env.example` and set `NEXT_PUBLIC_COLYSEUS_URL=wss://game.yourdomain.com`.

```bash
cd /opt/flag-forge
bash deploy/deploy.sh
```

### Architecture

```
internet ──> caddy (:80/:443) ─┬─> app:3000   Next.js HTTP
                               └─> app:3001   Colyseus WebSocket
```

Ports `3000`/`3001` are deliberately **not** published to the host. Caddy is the only public listener, so TLS terminates in one place and nothing but 80/443 is reachable from outside. The two hostnames are separate because the overlay and the game socket are different origins on different protocols; a single hostname would force path-based routing onto the WebSocket upgrade, which Colyseus does not expect.

`NEXT_PUBLIC_COLYSEUS_URL` is inlined into the browser bundle at **build** time, not read at runtime — that is why it is passed as a Docker build arg. A wrong value here is the usual cause of an overlay that loads but never connects to the game engine.

### CI/CD

`.github/workflows/deploy.yml` runs on **manual dispatch** only (Actions → Deploy → Run workflow). It is deliberately not wired to `push` yet: it needs six repository secrets and a `production` environment that do not exist, and a push-triggered workflow that always fails is worse than no automation. The gate against shipping a red build is still enforced — for `main` the job waits for the `CI` workflow to report success first, then SSHes to the VM and runs `deploy/deploy.sh`, which rebuilds and polls `/api/health` before reporting success.

Once a deploy has run green by hand, add the automatic trigger back:

```yaml
on:
  push:
    branches: ["main"]
  workflow_dispatch: ...
```

The image is built **on the VM**, not in CI, deliberately: the ARM Ampere host is where the artifact runs, and shipping `node_modules` from an x86 runner to an arm64 target is a reliable way to hit a platform mismatch.

Required repository secrets: `VM_SSH_KEY`, `VM_SSH_KNOWN_HOSTS`, `VM_SSH_USER`, `VM_HOST`, `PUBLIC_APP_URL`, `PUBLIC_WS_URL`. Note that `gh run list --commit` only matches a **full** SHA, which is why the CI-wait step queries `$GITHUB_SHA` rather than a short hash.

### Notes

- `tsx` is a runtime dependency, not a dev one. `server.ts` is TypeScript and `pnpm start` executes it through `tsx`, so a production-only install must keep it.
- The `NEXT_PUBLIC_COLYSEUS_URL` in `.env` must match the build arg. Compose enforces both from the same variable so a stale `ws://localhost:3001` placeholder cannot shadow the real one.

---

## Setup in OBS Studio

1. In OBS Studio, click **Add Source (+)** → **Browser Source**.
2. Enter URL: `http://localhost:3000/overlay`
3. Set Width: `1920`, Height: `1080`.
4. Check **"Control audio via OBS"** (audio starts after first click; browsers block autoplay otherwise).
5. Place animated background / lo-fi video on the bottom layer in OBS.
