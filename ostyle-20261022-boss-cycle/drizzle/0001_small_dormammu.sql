CREATE TABLE `leaderboard_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('unlimited','timeAttack') NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`timeSeconds` int,
	`stage` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaderboard_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `leaderboard_user_mode_unique` UNIQUE(`userId`,`mode`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `countryCode` varchar(2);--> statement-breakpoint
CREATE INDEX `leaderboard_mode_score_index` ON `leaderboard_entries` (`mode`,`score`);