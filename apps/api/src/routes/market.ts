import { Hono } from "hono";

export const marketRouter = new Hono();

/** GET /api/market/items — paginated item price analytics from cache.db */
marketRouter.get("/items", async (c) => {
  // TODO: query cache.db via @parazon/database
  return c.json({ items: [] });
});

/** GET /api/market/items/:itemName — price history for a specific item */
marketRouter.get("/items/:itemName", async (c) => {
  const itemName = c.req.param("itemName");
  // TODO: query cache.db via @parazon/database
  return c.json({ itemName, history: [] });
});
