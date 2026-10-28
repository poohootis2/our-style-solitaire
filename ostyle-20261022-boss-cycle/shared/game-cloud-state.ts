export type CloudGameState = {
  version: 1;
  savedAt: string;
  activeGame: { saveVersion: number; game: unknown; elapsedSeconds: number; gameMode?: "unlimited" | "timeAttack" };
  records: unknown;
  hammerCharges: number;
  unlockedPetIds: string[];
  unlockedBossBadges: string[];
  selectedCompanionId: string;
  selectedCardBackIndex: number | null;
  attendance: { day: number; lastDate: string | null };
  dailyAdRewards: { date: string | null; count: number; startedAt?: number | null };
  modeProgress: { unlimited: number; timeAttack: number };
  claimedBossPrepStages: number[];
  randomOwnedPetPerStage: boolean;
};
