CREATE TABLE `loadouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`warframe_unique_name` text NOT NULL,
	`primary_unique_name` text,
	`secondary_unique_name` text,
	`melee_unique_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE TABLE `warframe_items` (
	`unique_name` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`health` integer DEFAULT 0 NOT NULL,
	`shield` integer DEFAULT 0 NOT NULL,
	`armor` integer DEFAULT 0 NOT NULL,
	`energy` integer DEFAULT 0 NOT NULL,
	`sprint_speed` real DEFAULT 0 NOT NULL,
	`mastery_req` integer DEFAULT 0 NOT NULL,
	`is_prime` integer DEFAULT false NOT NULL,
	`is_umbra` integer DEFAULT false NOT NULL,
	`polarities_json` text DEFAULT '[]' NOT NULL,
	`aura_polarity` text DEFAULT '' NOT NULL,
	`image_name` text DEFAULT '' NOT NULL,
	`ingested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weapon_items` (
	`unique_name` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`faction` text DEFAULT 'Standard' NOT NULL,
	`mastery_req` integer DEFAULT 0 NOT NULL,
	`critical_chance` real DEFAULT 0 NOT NULL,
	`critical_multiplier` real DEFAULT 0 NOT NULL,
	`status_chance` real DEFAULT 0 NOT NULL,
	`fire_rate` real DEFAULT 0 NOT NULL,
	`damage_json` text DEFAULT '[]' NOT NULL,
	`stances_json` text DEFAULT '[]' NOT NULL,
	`image_name` text DEFAULT '' NOT NULL,
	`ingested_at` integer NOT NULL
);
