#!/usr/bin/env bash
#
# Build and roll the Flag Forge containers on the Oracle VM.
#
# Run on the VM (or over SSH from CI). Pulls main, rebuilds, and swaps the
# containers in. Safe to re-run: the compose stack is recreated in place.
#
# The image build is the slow step (~2-4 min on the ARM Ampere shape), so this
# is only worth running when the code actually changed.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/flag-forge}"
BRANCH="${BRANCH:-main}"
COMPOSE="${COMPOSE:-docker compose}"

cd "$APP_DIR"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- Preflight --------------------------------------------------------------
# Fail loudly before a 4-minute build if the required config is missing; these
# are the two things that actually break a deploy.
[[ -f .env ]] || die "no .env in $APP_DIR — copy .env.example and fill it in"
[[ -f deploy/Caddyfile ]] || die "deploy/Caddyfile missing"

# The Caddyfile is where a forgotten placeholder would silently ship, so check
# for the example hostnames instead of trusting a grep-free deploy.
if grep -q 'example\.com' deploy/Caddyfile; then
  die "deploy/Caddyfile still contains example.com hostnames — set your real domains first"
fi

NEXT_PUBLIC_COLYSEUS_URL="$(grep -E '^NEXT_PUBLIC_COLYSEUS_URL=' .env | cut -d= -f2- || true)"
[[ -n "$NEXT_PUBLIC_COLYSEUS_URL" ]] \
  || die "NEXT_PUBLIC_COLYSEUS_URL missing from .env (it is inlined into the browser bundle at build time)"
[[ "$NEXT_PUBLIC_COLYSEUS_URL" == wss://* || "$NEXT_PUBLIC_COLYSEUS_URL" == ws://* ]] \
  || die "NEXT_PUBLIC_COLYSEUS_URL must be a ws:// or wss:// URL, got '$NEXT_PUBLIC_COLYSEUS_URL'"

# --- Update code ------------------------------------------------------------
log "Fetching $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# --- Build ------------------------------------------------------------------
log "Building image (several minutes on first run)"
$COMPOSE build

# --- Roll -------------------------------------------------------------------
#
# `up -d` recreates only what changed. Anything already healthy keeps serving
# while the new image is built, so the stream is not interrupted.
log "Rolling containers"
$COMPOSE up -d --remove-orphans

# --- Verify -----------------------------------------------------------------
#
# A deploy that reports success but serves a 500 is worse than one that fails.
# Poll the health endpoint before declaring victory.
log "Waiting for health"
for attempt in $(seq 1 30); do
  if $COMPOSE exec -T app node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    log "Healthy after ${attempt} attempt(s)"
    $COMPOSE ps
    exit 0
  fi
  sleep 2
done

log "Container did not become healthy; last 40 log lines:"
$COMPOSE logs --tail=40 app
die "health check never passed"
