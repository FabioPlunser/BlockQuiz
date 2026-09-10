CREATE TABLE `class_users` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`added_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_users_class_user_source_uq` ON `class_users` (`class_id`,`user_id`,`source`);--> statement-breakpoint
CREATE INDEX `class_users_user_idx` ON `class_users` (`user_id`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sso_provider_id` text,
	`external_key` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_by` text,
	FOREIGN KEY (`sso_provider_id`) REFERENCES `ssoProvider`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `classes_provider_external_idx` ON `classes` (`sso_provider_id`,`external_key`);--> statement-breakpoint
CREATE INDEX `classes_name_idx` ON `classes` (`name`);--> statement-breakpoint
CREATE TABLE `course_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`class_id` text NOT NULL,
	`added_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_classes_course_class_uq` ON `course_classes` (`course_id`,`class_id`);--> statement-breakpoint
CREATE INDEX `course_classes_class_idx` ON `course_classes` (`class_id`);--> statement-breakpoint
CREATE TABLE `idp_group_seen` (
	`id` text PRIMARY KEY NOT NULL,
	`sso_provider_id` text NOT NULL,
	`external_key` text NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`sample_user_ids` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`sso_provider_id`) REFERENCES `ssoProvider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idp_group_seen_provider_key_uq` ON `idp_group_seen` (`sso_provider_id`,`external_key`);