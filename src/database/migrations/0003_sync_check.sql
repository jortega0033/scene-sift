ALTER TABLE `projects` ADD `sync_status` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `sync_checked_at` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `sync_warnings_json` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `sync_analysis_version` integer;
