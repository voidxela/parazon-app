import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/vector.ts",
  out: "./drizzle/vector",
  dbCredentials: {
    url: process.env.VECTOR_DB_PATH ?? "file:./data/knowledge_vector.db",
  },
});
