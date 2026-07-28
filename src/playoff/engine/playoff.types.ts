export const PLAYOFF_BRACKET_ENGINE_VERSION = 'playoff-bracket-v1';

export type PairingMode = 'cross_group_standard' | 'seeded_knockout';

export type QualifiedSeed = {
  teamId: string;
  groupId: string;
  /** Prefer group.label (A, B, …); fallback name */
  groupKey: string;
  rankPosition: number;
};

/** Seeded cup entry (knockout_only) — seedRank position 1..N */
export type KnockoutTeamSeed = {
  teamId: string;
  seed: number;
};

export type BracketSideKnown = {
  kind: 'seed';
  teamId: string;
  groupKey: string;
  rankPosition: number;
};

export type BracketSideFromWinner = {
  kind: 'winner_of';
  bracketPosition: string;
};

export type BracketSideBye = {
  kind: 'bye';
};

export type BracketSide =
  | BracketSideKnown
  | BracketSideFromWinner
  | BracketSideBye;

export type PlannedBracketMatch = {
  bracketPosition: string;
  round: 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';
  sideA: BracketSide;
  sideB: BracketSide;
  /** True when both sides are known seeds — safe to persist Match + participations */
  materialize: boolean;
  /** If set, this slot is a bye — winner advances without a Match row */
  byeWinnerTeamId?: string;
};

export type BracketStructure = {
  engineVersion: typeof PLAYOFF_BRACKET_ENGINE_VERSION;
  pairingMode: PairingMode;
  /** Group mode: qualifyTop. Knockout mode: entrant count (before byes). */
  qualifyTop: number;
  /** Knockout: bracket size after byes (power of 2). */
  bracketSize?: number;
  matches: PlannedBracketMatch[];
};

export type GenerateBracketResult = {
  structure: BracketStructure;
  /** Matches ready to insert (both teams known) */
  materializable: Array<{
    bracketPosition: string;
    teamAId: string;
    teamBId: string;
  }>;
  /** Bye slots that auto-advance (no Match row) */
  byeWinners: Array<{
    bracketPosition: string;
    winnerTeamId: string;
  }>;
};
