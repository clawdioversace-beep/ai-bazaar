CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`tags` text NOT NULL,
	`source_url` text NOT NULL,
	`docs_url` text,
	`license_type` text,
	`runtime` text,
	`chain_support` text,
	`mcp_compatible` integer DEFAULT false,
	`acp_compatible` integer DEFAULT false,
	`stars` integer DEFAULT 0,
	`downloads` integer DEFAULT 0,
	`last_verified_at` integer,
	`dead_link` integer DEFAULT false,
	`submitted_by` text,
	`verified` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_slug_unique` ON `listings` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_source_url_unique` ON `listings` (`source_url`);