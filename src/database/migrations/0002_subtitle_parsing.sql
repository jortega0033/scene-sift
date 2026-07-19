ALTER TABLE `projects` ADD `subtitle_status` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `subtitle_cue_count` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `subtitle_last_cue_end_ms` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `subtitle_parse_error` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `subtitle_parsed_at` integer;
--> statement-breakpoint
CREATE TABLE `subtitle_documents` (
	`project_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL DEFAULT 1,
	`source_format` text NOT NULL,
	`source_encoding` text NOT NULL,
	`cues_json` text NOT NULL,
	`warnings_json` text NOT NULL,
	`parsed_at` integer NOT NULL
);
