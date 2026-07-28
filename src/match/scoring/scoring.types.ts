export const PADEL_SCORING_ENGINE_VERSION = 'padel-scoring-v1';

export type Side = 'A' | 'B';

export type MatchFormat = 'best_of_1' | 'best_of_3' | 'best_of_5';
export type DeuceMode = 'golden_point' | 'advantage';
export type DecidingSetMode = 'full_set' | 'match_tiebreak';

export type TieBreakConfig = {
  atGames: number;
  pointsTo: number;
  mustWinBy: number;
};

export type ScoringConfig = {
  templateId: string;
  matchFormat: MatchFormat;
  gamesTo: number;
  mustWinBy: number;
  deuceMode: DeuceMode;
  decidingSet: DecidingSetMode;
  tieBreak: TieBreakConfig;
  matchTieBreak: TieBreakConfig;
};

export type GameState = {
  pointsA: number;
  pointsB: number;
  advantageSide: Side | null;
};

export type SetState = {
  gamesA: number;
  gamesB: number;
  tieBreak: { pointsA: number; pointsB: number } | null;
  game: GameState | null;
  winnerSide: Side | null;
  isMatchTieBreak: boolean;
};

export type ScoreState = {
  engineVersion: typeof PADEL_SCORING_ENGINE_VERSION;
  configSnapshot: ScoringConfig;
  sets: SetState[];
  setsWon: { A: number; B: number };
  phase: 'in_progress' | 'completed';
  winnerSide: Side | null;
  serverSide: Side | null;
};
