CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `video_path` text NOT NULL,
  `subtitle_path` text,
  `output_directory` text,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `app_settings` (
  `id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
  `ffmpeg_path_override` text,
  `ffprobe_path_override` text,
  `default_output_directory` text,
  `preferred_theme` text DEFAULT 'system' NOT NULL,
  `development_diagnostics_enabled` integer DEFAULT false NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `render_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `status` text DEFAULT 'queued' NOT NULL,
  `progress` real DEFAULT 0 NOT NULL,
  `output_path` text,
  `error_message` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
