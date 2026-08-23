CREATE TABLE `change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`old_scan_id` text,
	`new_scan_id` text NOT NULL,
	`detected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`change_type` text NOT NULL,
	`change_summary` text,
	`changes` text,
	`notification_sent` integer DEFAULT false,
	`notification_sent_at` integer,
	`provider` text,
	`provider_display_name` text,
	`prior_confidence` text,
	`new_confidence` text,
	`severity` text DEFAULT 'major',
	`alerted_at` integer,
	`alert_suppressed` integer DEFAULT false,
	`dismissed_until` integer,
	`model_hints` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leaderboard_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`iso_week` text NOT NULL,
	`taken_at` integer DEFAULT (unixepoch()) NOT NULL,
	`total_companies` integer NOT NULL,
	`top_provider` text,
	`changes_count` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_snapshots_iso_week_unique` ON `leaderboard_snapshots` (`iso_week`);--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_links_token_hash_unique` ON `magic_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `provider_rollups` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`logo_url` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_rollups_slug_unique` ON `provider_rollups` (`slug`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`domain` text,
	`user_id` text,
	`scanned_at` integer DEFAULT (unixepoch()) NOT NULL,
	`framework` text,
	`framework_confidence` text,
	`hosting` text,
	`hosting_confidence` text,
	`payments` text,
	`payments_confidence` text,
	`auth` text,
	`auth_confidence` text,
	`analytics` text,
	`analytics_confidence` text,
	`support` text,
	`support_confidence` text,
	`ai_provider` text,
	`ai_confidence` text,
	`ai_transport` text,
	`ai_gateway` text,
	`inference_host` text,
	`orchestration_framework` text,
	`model_tier` text,
	`is_agentic` integer DEFAULT false,
	`scan_phases` text DEFAULT '{"passive":"pending","render":"pending","probe":"locked"}',
	`scan_mode` text DEFAULT 'passive',
	`ttft` text,
	`tps` text,
	`inferred_model` text,
	`evidence` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `show_hn_products` (
	`id` text PRIMARY KEY NOT NULL,
	`hn_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`created_at` integer NOT NULL,
	`score` text NOT NULL,
	`comments_count` text,
	`hn_link` text NOT NULL,
	`product_url` text NOT NULL,
	`domain` text NOT NULL,
	`scan_id` text,
	`scan_status` text DEFAULT 'pending',
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_hn_products_hn_id_unique` ON `show_hn_products` (`hn_id`);--> statement-breakpoint
CREATE TABLE `show_hn_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`product_count` text NOT NULL,
	`date_range_start` integer NOT NULL,
	`date_range_end` integer NOT NULL,
	`aggregate_stats` text
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`domain` text NOT NULL,
	`display_label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_scanned_at` integer,
	`last_scan_id` text,
	`is_active` integer DEFAULT true,
	`notify_on_change` integer DEFAULT true,
	`alert_threshold` text,
	`slack_enabled` integer DEFAULT false,
	`next_scan_at` integer,
	`scan_status` text DEFAULT 'pending',
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`unreachable_notified_at` integer,
	`last_changed_at` integer,
	`paused_until` integer,
	`manual_scans_today` integer DEFAULT 0 NOT NULL,
	`manual_scan_reset_at` integer,
	`providers_detected` text DEFAULT '[]',
	`pending_removals` text DEFAULT '{}',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracked_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`yc_batch` text,
	`logo_url` text,
	`description` text,
	`status` text DEFAULT 'live' NOT NULL,
	`requested_by` text,
	`last_scan_id` text,
	`last_scanned_at` integer,
	`next_scan_at` integer,
	`scan_status` text DEFAULT 'pending',
	`prior_ai_provider` text,
	`prior_ai_confidence` text,
	`provider_changed_at` integer,
	`source` text,
	`imported_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_companies_slug_unique` ON `tracked_companies` (`slug`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email_alerts_enabled` integer DEFAULT true NOT NULL,
	`slack_alerts_enabled` integer DEFAULT false NOT NULL,
	`slack_webhook_url` text,
	`alert_frequency_cap` text DEFAULT 'immediate' NOT NULL,
	`global_alert_threshold` text DEFAULT 'any_change' NOT NULL,
	`min_confidence_to_alert` text DEFAULT 'medium' NOT NULL,
	`quiet_hours_start` integer,
	`quiet_hours_end` integer,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`alert_digest_mode` text DEFAULT 'individual' NOT NULL,
	`digest_enabled` integer DEFAULT true NOT NULL,
	`last_digest_sent_at` integer,
	`last_daily_bundle_at` integer,
	`alerts_this_week` integer DEFAULT 0 NOT NULL,
	`week_reset_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`email_verified` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_login_at` integer,
	`notifications_enabled` integer DEFAULT true,
	`plan_tier` text DEFAULT 'free' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);