CREATE TABLE `ai_provider_config` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`provider_type` text DEFAULT 'openai_compatible' NOT NULL,
	`base_url` text DEFAULT 'https://api.openai.com' NOT NULL,
	`model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`is_configured` integer DEFAULT false NOT NULL,
	`consent_recorded_at` integer,
	`last_test_status` text,
	`last_test_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_secrets` (
	`id` text PRIMARY KEY DEFAULT 'ai_provider' NOT NULL,
	`encrypted_key` blob,
	`updated_at` integer NOT NULL
);
