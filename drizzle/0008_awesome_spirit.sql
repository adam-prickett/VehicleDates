CREATE TABLE `notification_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`lead_days` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`sent_at` text DEFAULT (datetime('now')) NOT NULL,
	`status` text NOT NULL,
	`error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`lead_days_tax` text DEFAULT '[30,7,0]' NOT NULL,
	`lead_days_mot` text DEFAULT '[30,7,0]' NOT NULL,
	`lead_days_insurance` text DEFAULT '[30,7,0]' NOT NULL,
	`lead_days_service` text DEFAULT '[14,0]' NOT NULL,
	`send_hour` integer DEFAULT 9 NOT NULL,
	`send_minute` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'Europe/London' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
