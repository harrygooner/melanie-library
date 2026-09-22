CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`document_type` text NOT NULL,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`uploaded_by_email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_object_key_unique` ON `documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_product_id` ON `documents` (`product_id`);