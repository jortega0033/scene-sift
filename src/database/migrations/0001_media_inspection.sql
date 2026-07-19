ALTER TABLE `projects` ADD `duration_seconds` real;
--> statement-breakpoint
ALTER TABLE `projects` ADD `width` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `height` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `video_codec` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `fps` real;
--> statement-breakpoint
ALTER TABLE `projects` ADD `bit_rate_bps` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `file_size_bytes` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `inspected_at` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `inspection_error` text;
--> statement-breakpoint
UPDATE `projects` SET `status` = 'ready' WHERE `status` = 'active';
