import { createClient, type Client } from "@libsql/client";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

/** Lazily-initialised libSQL clients, one per database segment. */
let _usersClient: Client | undefined;
let _cacheClient: Client | undefined;
let _vectorClient: Client | undefined;

export function getUsersClient(): Client {
  _usersClient ??= createClient({ url: `file:${requireEnv("USERS_DB_PATH")}` });
  return _usersClient;
}

export function getCacheClient(): Client {
  _cacheClient ??= createClient({ url: `file:${requireEnv("CACHE_DB_PATH")}` });
  return _cacheClient;
}

export function getVectorClient(): Client {
  _vectorClient ??= createClient({ url: `file:${requireEnv("VECTOR_DB_PATH")}` });
  return _vectorClient;
}
