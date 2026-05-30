# Parazon

A cross-platform mobile companion for Warframe. Parazon provides live world-state tracking, market analytics, and an AI-driven loadout consultant ("Oracle") backed by a retrieval-augmented generation (RAG) pipeline.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Prerequisites](#3-prerequisites)
4. [Local Development Setup](#4-local-development-setup)
5. [Database Migrations & Vector Initialization](#5-database-migrations--vector-initialization)
6. [Running the Project](#6-running-the-project)
7. [Docker Deployment](#7-docker-deployment)

---

## 1. Architecture Overview

### Application

Parazon targets endgame Warframe players who need precise build crafting, live mission data, and inventory tracking in one place. The freemium "Parazon Prime" tier gates the Oracle AI consultant and advanced dashboard customization.

### Technical Stack

| Layer | Technology |
|---|---|
| Mobile client | React Native (Expo 52), Expo Router 4, TypeScript |
| State management | Zustand 5 |
| Authentication | Clerk (`@clerk/expo`) with custom RS256 JWKS verification on the backend |
| API server | Hono 4 on `@hono/node-server`, ESM, TypeScript |
| Process supervision | s6-overlay 3.2 (container) |
| ORM | Drizzle ORM |
| Databases | SQLite (local dev) / Turso libSQL (production edge) |
| Vector search | `sqlite-vec` (`vec0` virtual table, ANN via `vec_distance`) |
| AI / Embeddings | OpenAI `gpt-4o-mini` + `text-embedding-3-small` |
| Monorepo tooling | Turborepo 2, pnpm 9 workspaces |

### RAG Architecture

The Oracle's context window is populated from three tiers of data ingestion, each with a distinct update cadence:

**Tier 1 — Item catalogue (weekly)**
The community [`warframe-items`](https://github.com/WFCD/warframe-items) JSON dump is fetched, parsed, and upserted into `users.db`. Weapons are classified by faction (`Standard` / `Kuva` / `Tenet`) via `uniqueName` path-segment matching. Item descriptions are sanitized of HTML encoding and embedded into the vector index.

**Tier 2 — Wiki deep mechanics (on re-index)**
Wikitext is fetched directly from the Fandom MediaWiki API (bypassing HTML scraping) for a curated list of ~40 pages covering frames, weapons, open-world mechanics, and damage types. The wikitext is cleaned and split into semantic chunks on section headers, then embedded via `text-embedding-3-small` and stored in `knowledge_vector.db`. A SHA-256 content hash prevents re-embedding unchanged chunks.

**Tier 3 — Live world state (every 60 seconds)**
The `cacheSync` worker polls the [WarframeStat.us](https://warframestat.us/) API for active Void Fissures, Sorties, open-world cycle nodes, and Nightwave challenges, writing results to `cache.db`. At query time, the Oracle route reads this data and injects it directly into the LLM system prompt as plain text — it is not vectorized.

### Authentication

The Hono backend does not use the Clerk Node SDK. It implements its own RS256 JWT verification using the Web Crypto API, fetching the JWKS from the issuer URL embedded in `CLERK_PUBLISHABLE_KEY`. This keeps the runtime image lean. **The `CLERK_PUBLISHABLE_KEY` on the backend and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` on the mobile client must be the same key** — they identify the same Clerk application and share the same JWKS endpoint.

---

## 2. Monorepo Structure

```
parazon-app/
├── apps/
│   ├── api/                  # Hono microservice
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point, SIGTERM handler
│   │   │   ├── app.ts        # Hono app factory, route mounting
│   │   │   ├── middleware/   # Clerk JWT verification
│   │   │   ├── routes/       # fissures, loadouts, oracle
│   │   │   ├── lib/          # Ingestion parsers, embeddings, world-state client
│   │   │   └── workers/      # cacheSync, vectorIndexer (s6 longruns)
│   │   ├── rootfs/           # s6-overlay service definitions
│   │   └── Dockerfile        # Four-stage turbo prune build
│   │
│   └── mobile/               # Expo / React Native client
│       ├── app/              # Expo Router file-based routes
│       │   ├── (auth)/       # Sign-in screen
│       │   └── (tabs)/       # Dashboard, Arsenal, Market, Oracle
│       ├── components/       # Shared UI components (LoadoutCard, etc.)
│       ├── constants/        # Design tokens (theme.ts)
│       └── store/            # Zustand stores (app state, oracle session)
│
├── packages/
│   ├── database/             # Drizzle schemas, migrations, DB client factories
│   │   ├── src/
│   │   │   ├── clients.ts    # @libsql/client singletons (users, cache, vector)
│   │   │   ├── db.ts         # Drizzle instances + getVectorDb() singleton
│   │   │   ├── migrate.ts    # Migration runner (all three databases)
│   │   │   └── schema/       # Drizzle table definitions
│   │   └── drizzle/          # Generated migration SQL (users/, cache/, vector/)
│   │
│   ├── types/                # Shared TypeScript domain types (no runtime deps)
│   ├── eslint-config/        # Shared ESLint configuration
│   └── typescript-config/    # Shared tsconfig bases (base, node, react-native)
│
├── data/                     # Local SQLite database files (gitignored)
├── turbo.json
└── pnpm-workspace.yaml
```

**Separation of concerns:**
- `packages/types` — pure type definitions consumed by both `apps/api` and `apps/mobile`. No runtime code.
- `packages/database` — all database access logic. The API imports client factories and Drizzle instances from here; the mobile client never touches this package.
- `apps/api` — the only package that talks to OpenAI, the Warframe APIs, and the SQLite files.
- `apps/mobile` — the only package that talks to the Hono API. All data access is via HTTP.

---

## 3. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 22 | Required by the API (`node:22-alpine` in Docker) |
| pnpm | 9.15.4 | Install via `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| Docker | ≥ 24 | For container builds and local container testing |
| Expo CLI | Latest | `pnpm add -g expo-cli` or use `npx expo` |
| Expo Go / simulator | — | iOS Simulator, Android Emulator, or the Expo Go app |

---

## 4. Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/voidxela/parazon-app.git
cd parazon-app
pnpm install
```

### 2. Configure environment variables

**API** — copy the example file and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Description |
|---|---|
| `PORT` | Port the Hono server listens on. Default: `3000`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. For local dev: `http://localhost:8081`. |
| `CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key (`pk_test_...`). Used to derive the JWKS issuer URL for JWT verification. |
| `USERS_DB_PATH` | Absolute path to `users.db`. For local dev: `./data/users.db`. |
| `CACHE_DB_PATH` | Absolute path to `cache.db`. For local dev: `./data/cache.db`. |
| `VECTOR_DB_PATH` | Absolute path to `knowledge_vector.db`. For local dev: `./data/knowledge_vector.db`. |
| `OPENAI_API_KEY` | OpenAI API key. Required by the `vectorIndexer` worker and the Oracle route. |

**Mobile** — create `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:3000
```

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Must match `CLERK_PUBLISHABLE_KEY` in the API `.env`.** Both sides must reference the same Clerk application. If they differ, the backend's JWKS fetch will target a different issuer than the tokens the mobile client produces, and all authenticated requests will return 401. |
| `EXPO_PUBLIC_API_URL` | Base URL of the Hono API. For device testing on a local network, use your machine's LAN IP (e.g. `http://192.168.1.x:3000`) rather than `localhost`. |

### 3. Create the data directory

```bash
mkdir -p data
```

The three SQLite files are created automatically when migrations run.

---

## 5. Database Migrations & Vector Initialization

Run all three database migrations with:

```bash
pnpm --filter @parazon/database db:migrate
```

This applies pending Drizzle migrations to `users.db`, `cache.db`, and `knowledge_vector.db` in sequence.

**sqlite-vec requirement:** The `knowledge_vector.db` migration includes creation of the `vec0` virtual table (migration `0002_vec0_index.sql`). This requires the native `sqlite-vec` Node bindings, which are installed as a regular dependency of `@parazon/database`. As long as `pnpm install` has been run, the bindings are present and the migration will succeed locally — no separate extension installation is needed.

The migrator uses `getVectorDb()`, which loads the `sqlite-vec` extension into the `libsql` `Database` instance before any SQL runs. This ensures identical behaviour between local development and the production container.

**Generating new migrations** (after schema changes):

```bash
# Regenerate all three migration sets
pnpm --filter @parazon/database db:generate

# Or target a specific database
pnpm --filter @parazon/database db:generate:users
pnpm --filter @parazon/database db:generate:cache
pnpm --filter @parazon/database db:generate:vector
```

> Never modify the generated SQL files directly. All schema changes must go through Drizzle's schema definitions in `packages/database/src/schema/`.

---

## 6. Running the Project

### Start everything with Turborepo

```bash
pnpm dev
```

This runs `turbo run dev`, which starts the Hono API (`tsx watch`) and the Expo dev server concurrently, respecting the `^build` dependency order so workspace packages are compiled first.

### Start services individually

```bash
# API only
pnpm --filter @parazon/api dev

# Mobile only
pnpm --filter @parazon/mobile dev
```

### Typecheck all packages

```bash
pnpm typecheck
```

### Run tests

```bash
pnpm test
```

---

## 7. Docker Deployment

### Build the image

The Dockerfile uses a four-stage build with `turbo prune --docker` to produce a lean runtime image containing only compiled output and production `node_modules` — no build tooling, no lockfile, no source files.

```bash
# Build from the repository root (build context must include the full monorepo)
docker build -f apps/api/Dockerfile -t parazon-api:latest .
```

Build stages:
1. **pruner** — `turbo prune @parazon/api --docker` produces a minimal workspace subset.
2. **installer** — installs dependencies against the pruned manifests. This layer is cached independently of source changes.
3. **builder** — compiles all TypeScript packages.
4. **runner** — copies compiled output and `node_modules` only. No pnpm, no corepack.

### Run the container

```bash
docker run -d \
  --name parazon-api \
  -p 3000:3000 \
  -v /path/to/your/data:/data \
  -e PORT=3000 \
  -e ALLOWED_ORIGINS=https://your-app-domain.com \
  -e CLERK_PUBLISHABLE_KEY=pk_live_... \
  -e USERS_DB_PATH=/data/users.db \
  -e CACHE_DB_PATH=/data/cache.db \
  -e VECTOR_DB_PATH=/data/knowledge_vector.db \
  -e OPENAI_API_KEY=sk-... \
  parazon-api:latest
```

**`-v /path/to/your/data:/data`** — mount a persistent volume at `/data`. The three SQLite database files live here. Without a persistent mount, all data is lost when the container stops.

### Container startup sequence

s6-overlay supervises the following services in dependency order:

```
migrate (oneshot)
  └── api (longrun)
        ├── cache-sync (longrun)
        └── vector-indexer (longrun)
```

1. **migrate** runs `db:migrate` against all three databases. If it exits non-zero, the remaining services do not start and the container exits — preventing the API from running against a stale schema.
2. **api** starts the Hono HTTP server on `$PORT`.
3. **cache-sync** begins polling WarframeStat.us every 60 seconds.
4. **vector-indexer** runs the full Tier 1 + Tier 2 ingestion and embedding pipeline on startup, then idles. Re-indexing can be triggered by creating a sentinel file at `/data/.reindex`.

### Graceful shutdown

The container handles `SIGTERM` (sent by `docker stop` or a container orchestrator) in all three Node processes. The API server stops accepting new connections, waits for in-flight requests to complete, then closes all database connections before exiting. The `vector-indexer` has a 30-second SIGKILL timeout to allow an in-flight embedding batch to finish.
