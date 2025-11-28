 CREATE TABLE IF NOT EXISTS `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "active") SELECT "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "active" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);