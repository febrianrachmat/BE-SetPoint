export const PLAYOFF_BRACKET_ENGINE_VERSION = 'playoff-bracket-v1';

export type PairingMode = 'cross_group_standard';

export type QualifiedSeed = {
  teamId: string;
  groupId: string;
  /** Prefer group.label (A, B, …); fallback name */
  groupKey: string;
  rankPosition: number;
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

export type BracketSide = BracketSideKnown | BracketSideFromWinner;

export type PlannedBracketMatch = {
  bracketPosition: string;
  round: 'semi_final' | 'final';
  sideA: BracketSide;
  sideB: BracketSide;
  /** True when both sides are known seeds — safe to persist Match + participations */
  materialize: boolean;
};

export type BracketStructure = {
  engineVersion: typeof PLAYOFF_BRACKET_ENGINE_VERSION;
  pairingMode: PairingMode;
  qualifyTop: number;
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
};
