CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`awarded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`context_json` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ssoProvider` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`oidcConfig` text,
	`samlConfig` text,
	`userId` text,
	`providerId` text NOT NULL,
	`organizationId` text,
	`domain` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ssoProvider_providerId_unique` ON `ssoProvider` (`providerId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`user_id` text,
	`client_id` text,
	`actor_type` text DEFAULT 'user' NOT NULL,
	`workspace_xml` text DEFAULT '' NOT NULL,
	`generated_code` text DEFAULT '' NOT NULL,
	`result_json` text NOT NULL,
	`locale` text DEFAULT 'de' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT false NOT NULL,
	`hint_events_json` text DEFAULT '[]' NOT NULL,
	`analytics_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attempt_actor_check" CHECK(("__new_attempts"."actor_type" = 'user' AND "__new_attempts"."user_id" IS NOT NULL AND "__new_attempts"."client_id" IS NULL) OR ("__new_attempts"."actor_type" = 'guest' AND "__new_attempts"."user_id" IS NULL AND "__new_attempts"."client_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "exercise_id", "user_id", "client_id", "actor_type", "workspace_xml", "generated_code", "result_json", "locale", "started_at", "ended_at", "score", "passed", "hint_events_json", "analytics_json", "created_at") SELECT "id", "exercise_id", "user_id", "client_id", "actor_type", "workspace_xml", "generated_code", "result_json", "locale", "started_at", "ended_at", "score", "passed", "hint_events_json", "analytics_json", "created_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`type` text NOT NULL,
	`image` text,
	`content` text NOT NULL,
	`config` text NOT NULL,
	`validation_json` text DEFAULT '{"valid":false,"issues":[]}' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`archived_by` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`archived_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercises`("id", "course_id", "type", "image", "content", "config", "validation_json", "published", "archived_at", "archived_by", "order", "created_by", "created_at", "updated_at") SELECT "id", "course_id", "type", "image", "content", "config", "validation_json", "published", "archived_at", "archived_by", "order", "created_by", "created_at", "updated_at" FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
ALTER TABLE `courses` ADD `content` text NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `archived_by` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `createdBy` text NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `updated_at`;