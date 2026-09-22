CREATE TABLE `document_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`requested_types` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`requester_id` text NOT NULL,
	`requester_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by_email` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_document_requests_product_id` ON `document_requests` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_document_requests_status` ON `document_requests` (`status`);