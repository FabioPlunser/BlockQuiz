ALTER TABLE `exercises` ADD `validation_json` text DEFAULT '{"valid":false,"issues":[]}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `actor_type` text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `workspace_xml` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `generated_code` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `hint_events_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `analytics_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE `attempts`
SET
	`actor_type` = CASE
		WHEN `user_id` IS NOT NULL THEN 'user'
		ELSE 'guest'
	END,
	`workspace_xml` = COALESCE(`workspace_xml`, ''),
	`generated_code` = COALESCE(`generated_code`, ''),
	`ended_at` = COALESCE(`ended_at`, `started_at`),
	`score` = COALESCE(`score`, 0),
	`passed` = COALESCE(`passed`, 0),
	`hint_events_json` = COALESCE(`hint_events_json`, '[]'),
	`analytics_json` = COALESCE(`analytics_json`, '{}');
--> statement-breakpoint
UPDATE `exercises`
SET `validation_json` = COALESCE(`validation_json`, '{"valid":false,"issues":[]}');
