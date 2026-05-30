CREATE TABLE `cycle_nodes` (
	`node_key` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`expiry` integer NOT NULL,
	`activation` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fissures` (
	`id` text PRIMARY KEY NOT NULL,
	`node` text NOT NULL,
	`mission_type` text NOT NULL,
	`enemy` text NOT NULL,
	`tier` text NOT NULL,
	`tier_num` integer NOT NULL,
	`is_storm` integer NOT NULL,
	`is_hard` integer NOT NULL,
	`activation` integer NOT NULL,
	`expiry` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `nightwave_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`nightwave_id` text NOT NULL,
	`title` text NOT NULL,
	`desc` text NOT NULL,
	`reputation` integer NOT NULL,
	`is_daily` integer NOT NULL,
	`is_elite` integer NOT NULL,
	`activation` integer NOT NULL,
	`expiry` integer NOT NULL,
	FOREIGN KEY (`nightwave_id`) REFERENCES `nightwaves`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nightwaves` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer NOT NULL,
	`tag` text NOT NULL,
	`phase` integer NOT NULL,
	`activation` integer NOT NULL,
	`expiry` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_url_name` text NOT NULL,
	`datetime` integer NOT NULL,
	`avg_price` real NOT NULL,
	`min_price` real NOT NULL,
	`max_price` real NOT NULL,
	`volume` integer NOT NULL,
	`median` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sorties` (
	`id` text PRIMARY KEY NOT NULL,
	`boss` text NOT NULL,
	`faction` text NOT NULL,
	`variants_json` text NOT NULL,
	`activation` integer NOT NULL,
	`expiry` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
