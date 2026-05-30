import { defineConfig } from "drizzle-kit";

// drizzle-kit operates on the users.db schema by default.
// Run with --config pointing to the appropriate config for cache/vector DBs.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/users.ts",
  out: "./drizzle/users",
  dbCredentials: {
    url: process.env.USERS_DB_PATH ?? "file:./data/users.db",
  },
});
