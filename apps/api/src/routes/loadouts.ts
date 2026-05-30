import { Hono } from "hono";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { getUsersClient, loadouts } from "@parazon/database";
import { type HonoVariables } from "../types.js";

export const loadoutsRouter = new Hono<{ Variables: HonoVariables }>();

/**
 * GET /api/loadouts
 * Returns all loadouts for the authenticated user.
 */
loadoutsRouter.get("/", async (c) => {
  const clerkUserId = c.get("clerkUserId") as string;
  const db = drizzle(getUsersClient());

  const rows = await db
    .select()
    .from(loadouts)
    .where(eq(loadouts.userId, clerkUserId));

  return c.json(rows);
});

interface CreateLoadoutBody {
  name: string;
  warframeUniqueName: string;
  primaryUniqueName?: string;
  secondaryUniqueName?: string;
  meleeUniqueName?: string;
}

/**
 * POST /api/loadouts
 * Creates a new loadout for the authenticated user.
 */
loadoutsRouter.post("/", async (c) => {
  const clerkUserId = c.get("clerkUserId") as string;
  const body = await c.req.json<CreateLoadoutBody>();

  if (!body.name || !body.warframeUniqueName) {
    return c.json({ error: "name and warframeUniqueName are required" }, 400);
  }

  const db = drizzle(getUsersClient());
  const now = new Date();
  const id = ulid();

  await db.insert(loadouts).values({
    id,
    userId: clerkUserId,
    name: body.name,
    warframeUniqueName: body.warframeUniqueName,
    primaryUniqueName: body.primaryUniqueName ?? null,
    secondaryUniqueName: body.secondaryUniqueName ?? null,
    meleeUniqueName: body.meleeUniqueName ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ id }, 201);
});

/**
 * DELETE /api/loadouts/:id
 * Deletes a loadout owned by the authenticated user.
 */
loadoutsRouter.delete("/:id", async (c) => {
  const clerkUserId = c.get("clerkUserId") as string;
  const loadoutId = c.req.param("id");
  const db = drizzle(getUsersClient());

  const existing = await db
    .select({ userId: loadouts.userId })
    .from(loadouts)
    .where(eq(loadouts.id, loadoutId));

  if (existing.length === 0) return c.json({ error: "Not found" }, 404);
  if (existing[0]?.userId !== clerkUserId) return c.json({ error: "Forbidden" }, 403);

  await db.delete(loadouts).where(eq(loadouts.id, loadoutId));
  return c.body(null, 204);
});
