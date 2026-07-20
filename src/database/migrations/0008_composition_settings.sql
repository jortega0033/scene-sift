CREATE TABLE `project_composition_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`resolution` text NOT NULL DEFAULT '1080x1920',
	`background_style` text NOT NULL DEFAULT 'blur',
	`subtitle_position` text NOT NULL DEFAULT 'bottom',
	`font_family` text NOT NULL DEFAULT 'Arial',
	`font_size` integer NOT NULL DEFAULT 32,
	`font_color` text NOT NULL DEFAULT '#FFFFFF',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
