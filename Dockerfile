# syntax=docker/dockerfile:1
# Flag Forge runs a custom Node server (server.ts) that hosts BOTH Next.js and a
# Colyseus WebSocket game engine. There is no `next start` entrypoint here — the
# build only produces the .next artifacts that server.ts loads at runtime.
#
# The WebSocket transport needs raw `ws` upgrade handling, so this app cannot be
# deployed to a serverless/static host. It needs a long-lived process, which is
# what the Oracle Cloud VM (4 core / 24 GB) provides.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: full install (dev deps included) so the build can typecheck/transpile.
# Frozen lockfile keeps CI and the VM byte-identical.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build: compile the Next.js app.
#
# NEXT_PUBLIC_* values are inlined at build time, so NEXT_PUBLIC_COLYSEUS_URL
# must be supplied as a build arg or the overlay will keep pointing at
# ws://localhost:3001 in the browser.
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_COLYSEUS_URL
ENV NEXT_PUBLIC_COLYSEUS_URL=$NEXT_PUBLIC_COLYSEUS_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ---------------------------------------------------------------------------
# prod-deps: a second, production-only install.
#
# Reusing deps/ would ship every dev dependency (TypeScript, ESLint, the whole
# Next.js compiler) into the runtime image. tsx is a *runtime* dependency here
# because it is what executes server.ts, so it survives `--prod`.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# runner: production dependencies only, plus the compiled app and server.ts.
#
# The custom server means the full Next.js package is needed at runtime, not
# just a standalone server bundle.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=3000
ENV COLYSEUS_PORT=3001

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json pnpm-lock.yaml ./
COPY next.config.ts tsconfig.json ./
COPY server.ts ./
COPY src ./src

# Never run the container as root: server.ts binds two ports and writes nothing
# to disk, so there is no reason to grant it more.
USER node

# The overlay is health-gated on the HTTP side; Colyseus shares the process, so
# a healthy /api/health implies the game engine came up too.
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "run", "start"]
