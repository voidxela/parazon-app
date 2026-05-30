import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type Database from "libsql";
import DatabaseConstructor from "libsql";
import * as sqliteVec from "sqlite-vec";
import { getUsersClient, getCacheClient } from "./clients.js";
import * as usersSchema from "./schema/users.js";
import * as itemsSchema from "./schema/items.js";
import * as cacheSchema from "./schema/cache.js";
import * as vectorSchema from "./schema/vector.js";

const mergedUsersSchema = { ...usersSchema, ...itemsSchema };

/** Pre-built Drizzle instance for users.db (includes item catalogue tables). */
export function getUsersDb(): LibSQLDatabase<typeof mergedUsersSchema> {
  return drizzleLibsql(getUsersClient(), { schema: mergedUsersSchema });
}

/** Pre-built Drizzle instance for cache.db. */
export function getCacheDb(): LibSQLDatabase<typeof cacheSchema> {
  return drizzleLibsql(getCacheClient(), { schema: cacheSchema });
}

/** Return type for getVectorDb — includes $client for raw vec0 queries. */
export type VectorDb = BetterSQLite3Database<typeof vectorSchema> & { $client: Database.Database };

/** Module-level singleton — opened once, reused for the process lifetime. */
let _vectorDb: VectorDb | undefined;

/**
 * Returns the singleton Drizzle instance for knowledge_vector.db.
 *
 * The libsql Database connection and the sqlite-vec extension are initialised
 * exactly once on first call and reused across all subsequent requests. This
 * prevents file-descriptor exhaustion under concurrent load.
 *
 * Uses libsql's Database directly (rather than @libsql/client) so we can call
 * loadExtension() before any query — @libsql/client does not expose that API.
 */
export function getVectorDb(): VectorDb {
  if (_vectorDb) return _vectorDb;

  const path = process.env["VECTOR_DB_PATH"];
  if (!path) throw new Error("Missing required environment variable: VECTOR_DB_PATH");

  const raw = new DatabaseConstructor(path);
  sqliteVec.load(raw);
  _vectorDb = drizzleSqlite(raw, { schema: vectorSchema }) as VectorDb;
  return _vectorDb;
}
