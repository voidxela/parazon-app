import { Hono } from "hono";
import { drizzle } from "drizzle-orm/libsql";
import { getCacheClient, fissures } from "@parazon/database";

export const fissuresRouter = new Hono();

/**
 * GET /api/fissures
 * Returns all active fissures from the cache database.
 */
fissuresRouter.get("/", async (c) => {
  const db = drizzle(getCacheClient());
  const rows = await db.select().from(fissures);
  return c.json(rows);
});
