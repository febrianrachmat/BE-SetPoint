export type Side = 'A' | 'B';

/**
 * Ordered tie-break criteria (Step 9B).
 * `random_draw` never auto-shuffles — marks `random_draw_pending` for Admin (STD-05).
 */
export type TieBreakCriterion =
  | 'points'
  | 'wins'
  | 'head_to_head'
  | 'set_difference'
  | 'sets_won'
  | 'game_difference'
  | 'random_draw';

export const DEFAULT_TIE_BREAK_ORDER: TieBreakCriterion[] = [
  'points',
  'wins',
  'head_to_head',
  'set_difference',
  'game_difference',
];

export type StandingsConfig = {
  pointsForWin: number;
  pointsForLoss: number;
  tieBreakOrder: TieBreakCriterion[];
};

export const DEFAULT_STANDINGS_CONFIG: StandingsConfig = {
  pointsForWin: 1,
  pointsForLoss: 0,
  tieBreakOrder: [...DEFAULT_TIE_BREAK_ORDER],
};

/** Verified match facts consumed by the standing calculator (no Nest/Prisma). */
export type StandingMatchInput = {
  teamAId: string;
  teamBId: string;
  winnerSide: Side;
  setsWon: { A: number; B: number };
  sets: Array<[number, number]>;
};

export type TeamStandingStats = {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

export type RankedStanding = TeamStandingStats & {
  rankPosition: number;
  tieBreakNotes: string | null;
};
