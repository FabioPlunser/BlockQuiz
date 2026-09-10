ALTER TABLE `audit_logs` ADD `category` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_logs_actor_ts_idx` ON `audit_logs` (`actor_user_id`,`ts`);--> statement-breakpoint
CREATE INDEX `audit_logs_category_ts_idx` ON `audit_logs` (`category`,`ts`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_ts_idx` ON `audit_logs` (`action`,`ts`);--> statement-breakpoint
CREATE INDEX `audit_logs_ts_idx` ON `audit_logs` (`ts`);
