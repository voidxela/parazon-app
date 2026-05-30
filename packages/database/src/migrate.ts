/**
 * Applies pending Drizzle migrations to all three database segments.
 * Run via: pnpm --filter @parazon/database db:migrate
 *
 * users.db and cache.db use drizzle-orm/libsql (async, @libsql/client).
 *
 * knowledge_vector.db uses drizzle-orm/better-sqlite3 via getVectorDb(),
 * which opens the database with the sqlite-vec extension pre-loaded. This
 * guarantees the vec0 virtual table migration (0002) runs successfully in
 * both local dev and the runtime container — true dev/prod parity.
 *
 * Migration folder paths are resolved relative to this file's location so
 * the script works regardless of the process working directory (important
 * for the container s6 oneshot which runs from /app).
 */

import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { getUsersClient, getCacheClient } from "./clients.js";
import { getVectorDb } from "./db.js";

// Resolve the drizzle/ folder relative to this compiled file, not CWD.
// In local dev: packages/database/src/ → packages/database/drizzle/
// In container: /app/node_modules/@parazon/database/dist/ → .../drizzle/
const here = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(here, "..", "drizzle");

async function runMigrations(): Promise<void> {
  console.log("Running migrations for users.db…");
  const usersDb = drizzle(getUsersClient());
  await migrateLibsql(usersDb, { migrationsFolder: join(drizzleDir, "users") });

  console.log("Running migrations for cache.db…");
  const cacheDb = drizzle(getCacheClient());
  await migrateLibsql(cacheDb, { migrationsFolder: join(drizzleDir, "cache") });

  // The vector DB migrator uses the better-sqlite3 driver so the sqlite-vec
  // extension is loaded before any migration SQL runs. Migration 0002 creates
  // the vec0 virtual table — this now works identically in local dev and prod.
  console.log("Running migrations for knowledge_vector.db…");
  const vectorDb = getVectorDb();
  migrateSqlite(vectorDb, { migrationsFolder: join(drizzleDir, "vector") });

  console.log("All migrations complete.");
}

await runMigrations();
