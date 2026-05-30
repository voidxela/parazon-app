CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`content` text NOT NULL,
	`embedding` blob NOT NULL,
	`created_at` integer NOT NULL
);
