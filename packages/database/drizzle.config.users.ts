import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/schema/users.ts", "./src/schema/items.ts"],
  out: "./drizzle/users",
  dbCredentials: {
    url: process.env.USERS_DB_PATH ?? "file:./data/users.db",
  },
});
