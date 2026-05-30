# syntax=docker/dockerfile:1
#
# Four-stage build using turbo prune --docker for a lean production image.
#
# Stages:
#   pruner    — turbo prune produces a minimal workspace subset for @parazon/api
#   installer — install all deps against the pruned manifest/lockfile (cached layer)
#   builder   — copy full source over node_modules, compile TypeScript
#   runner    — copy only compiled output + node_modules; no build tooling

# ── Stage 1: pruner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY . .

# Produce two output trees under /repo/out:
#   out/json/  — package.json files only (for install layer caching)
#   out/full/  — complete pruned source tree
# Pin turbo version to match the workspace to ensure reproducible builds.
RUN npx turbo@2.3.3 prune @parazon/api --docker --out-dir=out

# ── Stage 2: installer ────────────────────────────────────────────────────────
FROM node:22-alpine AS installer

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy pruned manifests + lockfile first — this layer is cached as long as
# no package.json or pnpm-lock.yaml in the pruned scope changes.
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# ── Stage 3: builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Bring in the installed node_modules from the installer stage, then overlay
# the full pruned source tree on top.
COPY --from=installer /repo/ .
COPY --from=pruner    /repo/out/full/ .

# Build the dependency packages first, then the API
RUN pnpm --filter @parazon/types build \
 && pnpm --filter @parazon/database build \
 && pnpm --filter @parazon/api build

# ── Stage 4: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install s6-overlay
ARG S6_OVERLAY_VERSION=3.2.0.2
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp/
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp/
RUN apk add --no-cache xz \
 && tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz \
 && tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz \
 && rm /tmp/s6-overlay-*.tar.xz

# Non-root user for the application processes
RUN addgroup -S parazon && adduser -S -G parazon parazon

# The runner uses the same workspace-root layout as the builder so that pnpm's
# node_modules structure (hoisted at /app, per-package under /app/apps/api etc.)
# is preserved and Node module resolution works without modification.
WORKDIR /app

# Compiled API output and its package.json (needed for the exports map)
COPY --from=builder --chown=parazon:parazon /repo/apps/api/dist        ./apps/api/dist
COPY --from=builder --chown=parazon:parazon /repo/apps/api/package.json ./apps/api/package.json

# Workspace package manifests + compiled dist — Node needs package.json to
# resolve the exports map for subpath imports (e.g. @parazon/database/schema).
COPY --from=builder --chown=parazon:parazon /repo/packages/types/package.json    ./packages/types/package.json
COPY --from=builder --chown=parazon:parazon /repo/packages/types/dist            ./packages/types/dist
COPY --from=builder --chown=parazon:parazon /repo/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=parazon:parazon /repo/packages/database/dist         ./packages/database/dist
# Migration SQL files co-located with migrate.js for import.meta.url resolution
COPY --from=builder --chown=parazon:parazon /repo/packages/database/drizzle      ./packages/database/drizzle

# Root package.json and workspace manifest (required for pnpm workspace linking)
COPY --from=builder --chown=parazon:parazon /repo/package.json          ./package.json
COPY --from=builder --chown=parazon:parazon /repo/pnpm-workspace.yaml   ./pnpm-workspace.yaml

# All production node_modules from the installer stage — no pnpm install needed
# in the runner image. Includes native binaries for sqlite-vec and libsql.
COPY --from=installer --chown=parazon:parazon /repo/node_modules         ./node_modules
COPY --from=installer --chown=parazon:parazon /repo/apps/api/node_modules ./apps/api/node_modules

# Copy s6-overlay service definitions
COPY --chown=root:root apps/api/rootfs/ /

# Ensure all s6 run/finish/up scripts are executable
RUN find /etc/s6-overlay/s6-rc.d -type f \( -name "run" -o -name "finish" -o -name "up" \) \
      | xargs chmod +x \
 && find /etc/s6-overlay/scripts -type f | xargs chmod +x 2>/dev/null || true

# Data volume for SQLite databases — mounted at runtime
VOLUME ["/data"]

EXPOSE 3000

# s6-overlay requires PID 1
ENTRYPOINT ["/init"]
