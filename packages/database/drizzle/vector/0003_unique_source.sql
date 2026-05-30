-- Enforce uniqueness on the `source` column so each chunk has exactly one
-- row in the documents table. This replaces the delete+insert workaround
-- in the embedding pipeline with a proper ON CONFLICT DO UPDATE upsert.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `documents_source_unique` ON `documents` (`source`);
