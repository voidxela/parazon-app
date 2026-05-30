import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * users.db schema
 *
 * Stores Parazon-specific user profile data. Auth identity is owned by Clerk;
 * `clerkId` is the foreign key linking the two systems.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // ULID generated application-side
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const loadouts = sqliteTable("loadouts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  warframeUniqueName: text("warframe_unique_name").notNull(),
  primaryUniqueName: text("primary_unique_name"),
  secondaryUniqueName: text("secondary_unique_name"),
  meleeUniqueName: text("melee_unique_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
