CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`user_id` text,
	`client_id` text,
	`result_json` text NOT NULL,
	`locale` text DEFAULT 'de' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`score` integer,
	`passed` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`details_json` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`message` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`meta_json` text NOT NULL,
	`content_json` text NOT NULL,
	`toolbox_json` text NOT NULL,
	`starter_xml` text,
	`grader_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`title_json` text NOT NULL,
	`exercises_json` text NOT NULL,
	`randomize` integer DEFAULT false NOT NULL,
	`prerequisites_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);