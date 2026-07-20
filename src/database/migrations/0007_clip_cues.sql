CREATE TABLE `clip_cues` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`sequence_index` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `clip_candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clip_cues_candidate_id_idx` ON `clip_cues` (`candidate_id`);
