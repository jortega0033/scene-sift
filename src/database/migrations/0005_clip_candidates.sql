ALTER TABLE `projects` ADD `candidate_generation_status` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `candidate_generation_error` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `candidate_generated_at` integer;
--> statement-breakpoint
CREATE TABLE `clip_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`candidate_status` text DEFAULT 'suggested' NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`title` text NOT NULL,
	`reason` text NOT NULL,
	`score_raw` real NOT NULL,
	`sort_order` integer NOT NULL,
	`model_id` text NOT NULL,
	`prompt_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
