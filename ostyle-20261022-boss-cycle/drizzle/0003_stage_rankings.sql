CREATE TABLE `leaderboard_stage_entries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `mode` enum('unlimited','timeAttack') NOT NULL,
  `stage` int NOT NULL,
  `score` int NOT NULL DEFAULT 0,
  `timeSeconds` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `leaderboard_stage_entries_id` PRIMARY KEY(`id`),
  CONSTRAINT `leaderboard_stage_user_mode_stage_unique` UNIQUE(`userId`,`mode`,`stage`),
  INDEX `leaderboard_stage_mode_stage_score_index` (`mode`,`stage`,`score`)
);
--> statement-breakpoint
INSERT INTO `leaderboard_stage_entries` (`userId`, `mode`, `stage`, `score`, `timeSeconds`)
SELECT `userId`, `mode`, `stage`, `score`, `timeSeconds` FROM `leaderboard_entries`;
