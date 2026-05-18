PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` text PRIMARY KEY NOT NULL,
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
	FOREIGN KEY (`archived_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercises`("id", "type", "image", "content", "config", "validation_json", "published", "archived_at", "archived_by", "order", "created_by", "created_at", "updated_at") SELECT "id", "type", "image", "content", "config", "validation_json", "published", "archived_at", "archived_by", "order", "created_by", "created_at", "updated_at" FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;