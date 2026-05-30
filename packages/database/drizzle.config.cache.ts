import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/cache.ts",
  out: "./drizzle/cache",
  dbCredentials: {
    url: process.env.CACHE_DB_PATH ?? "file:./data/cache.db",
  },
});
