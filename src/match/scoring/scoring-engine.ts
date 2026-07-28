import {
  PADEL_SCORING_ENGINE_VERSION,
  GameState,
  ScoreState,
  ScoringConfig,
  SetState,
  Side,
} from './scoring.types';

function opposite(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

function setsNeededToWin(format: ScoringConfig['matchFormat']): number {
  switch (format) {
    case 'best_of_1':
      return 1;
    case 'best_of_3':
      return 2;
    case 'best_of_5':
      return 3;
  }
}

function maxSets(format: ScoringConfig['matchFormat']): number {
  switch (format) {
    case 'best_of_1':
      return 1;
    case 'best_of_3':
      return 3;
    case 'best_of_5':
      return 5;
  }
}

function emptyGame(): GameState {
  return { pointsA: 0, pointsB: 0, advantageSide: null };
}

function emptySet(isMatchTieBreak = false): SetState {
  return {
    gamesA: 0,
    gamesB: 0,
    tieBreak: isMatchTieBreak ? { pointsA: 0, pointsB: 0 } : null,
    game: isMatchTieBreak ? null : emptyGame(),
    winnerSide: null,
    isMatchTieBreak,
  };
}

function cloneState(state: ScoreState): ScoreState {
  return structuredClone(state);
}

function currentSet(state: ScoreState): SetState {
  return state.sets[state.sets.length - 1];
}

function isDecidingSet(state: ScoreState): boolean {
  const needed = setsNeededToWin(state.configSnapshot.matchFormat);
  return (
    state.setsWon.A === needed - 1 &&
    state.setsWon.B === needed - 1 &&
    state.configSnapshot.matchFormat !== 'best_of_1'
  );
}

function shouldStartMatchTieBreak(state: ScoreState): boolean {
  return (
    isDecidingSet(state) &&
    state.configSnapshot.decidingSet === 'match_tiebreak'
  );
}

function isSetTieBreakTrigger(
  gamesA: number,
  gamesB: number,
  config: ScoringConfig,
): boolean {
  const at = config.tieBreak.atGames;
  return gamesA === at && gamesB === at;
}

function setWonBySide(
  gamesA: number,
  gamesB: number,
  config: ScoringConfig,
): Side | null {
  const { gamesTo, mustWinBy } = config;
  if (gamesA >= gamesTo && gamesA - gamesB >= mustWinBy) return 'A';
  if (gamesB >= gamesTo && gamesB - gamesA >= mustWinBy) return 'B';
  return null;
}

function tieBreakWon(
  pointsA: number,
  pointsB: number,
  pointsTo: number,
  mustWinBy: number,
): Side | null {
  if (pointsA >= pointsTo && pointsA - pointsB >= mustWinBy) return 'A';
  if (pointsB >= pointsTo && pointsB - pointsA >= mustWinBy) return 'B';
  return null;
}

function applyGamePoint(
  game: GameState,
  side: Side,
  deuceMode: ScoringConfig['deuceMode'],
): { game: GameState; gameWonBy: Side | null } {
  const next = { ...game };
  if (deuceMode === 'golden_point') {
    // Standard padel golden point: at 40-40 (3-3), next point wins game.
    // Before that: 0,15,30,40 then game (points 0..3, game at 4 if opponent < 3,
    // or at deuce when both >= 3 then golden point).
    if (side === 'A') next.pointsA += 1;
    else next.pointsB += 1;

    const a = next.pointsA;
    const b = next.pointsB;

    // Both reached 3 (40-40) → next point already counted → winner
    if (a >= 3 && b >= 3) {
      // After point from deuce: one side is ahead by 1 → that side wins (golden)
      if (a !== b) {
        return { game: emptyGame(), gameWonBy: a > b ? 'A' : 'B' };
      }
      // Still equal somehow (shouldn't after +1) — treat as still deuce
      return { game: next, gameWonBy: null };
    }

    // Someone reached 4+ without both at 3 → win if ahead and opponent has < 3
    if (a >= 4 && a > b) return { game: emptyGame(), gameWonBy: 'A' };
    if (b >= 4 && b > a) return { game: emptyGame(), gameWonBy: 'B' };

    return { game: next, gameWonBy: null };
  }

  // Advantage scoring
  if (side === 'A') next.pointsA += 1;
  else next.pointsB += 1;

  const a = next.pointsA;
  const b = next.pointsB;

  if (a >= 3 && b >= 3) {
    if (a === b) {
      next.advantageSide = null;
      return { game: next, gameWonBy: null };
    }
    if (Math.abs(a - b) === 1) {
      next.advantageSide = a > b ? 'A' : 'B';
      return { game: next, gameWonBy: null };
    }
    // Win by 2 from deuce
    return { game: emptyGame(), gameWonBy: a > b ? 'A' : 'B' };
  }

  if (a >= 4 && a - b >= 2) return { game: emptyGame(), gameWonBy: 'A' };
  if (b >= 4 && b - a >= 2) return { game: emptyGame(), gameWonBy: 'B' };

  return { game: next, gameWonBy: null };
}

function completeSet(state: ScoreState, set: SetState, winner: Side): void {
  set.winnerSide = winner;
  set.game = null;
  set.tieBreak = null;
  state.setsWon[winner] += 1;

  const needed = setsNeededToWin(state.configSnapshot.matchFormat);
  if (state.setsWon[winner] >= needed) {
    state.phase = 'completed';
    state.winnerSide = winner;
    return;
  }

  if (state.sets.length >= maxSets(state.configSnapshot.matchFormat)) {
    // Safety: shouldn't happen if setsNeeded is correct
    state.phase = 'completed';
    state.winnerSide = winner;
    return;
  }

  // Start next set
  if (shouldStartMatchTieBreak(state)) {
    state.sets.push(emptySet(true));
  } else {
    state.sets.push(emptySet(false));
  }
}

/**
 * Create initial score state from a validated ScoringConfig snapshot.
 */
export function createInitialState(config: ScoringConfig): ScoreState {
  const useMatchTb =
    config.matchFormat === 'best_of_1' && config.decidingSet === 'match_tiebreak';

  return {
    engineVersion: PADEL_SCORING_ENGINE_VERSION,
    configSnapshot: structuredClone(config),
    sets: [emptySet(useMatchTb)],
    setsWon: { A: 0, B: 0 },
    phase: 'in_progress',
    winnerSide: null,
    serverSide: 'A',
  };
}

/**
 * Apply one point to the given side. Returns a new state (immutable).
 * Throws if match already completed.
 */
export function applyPoint(state: ScoreState, side: Side): ScoreState {
  if (side !== 'A' && side !== 'B') {
    throw new Error('side must be A or B');
  }
  if (state.phase === 'completed') {
    throw new Error('Match already completed');
  }

  const next = cloneState(state);
  const set = currentSet(next);
  const config = next.configSnapshot;

  // Match tie-break set (deciding set mode)
  if (set.isMatchTieBreak) {
    if (!set.tieBreak) {
      set.tieBreak = { pointsA: 0, pointsB: 0 };
    }
    if (side === 'A') set.tieBreak.pointsA += 1;
    else set.tieBreak.pointsB += 1;

    const winner = tieBreakWon(
      set.tieBreak.pointsA,
      set.tieBreak.pointsB,
      config.matchTieBreak.pointsTo,
      config.matchTieBreak.mustWinBy,
    );
    if (winner) {
      // Represent match TB as games 1-0 for display consistency
      if (winner === 'A') set.gamesA = 1;
      else set.gamesB = 1;
      completeSet(next, set, winner);
    }
    return next;
  }

  // Regular set tie-break in progress
  if (set.tieBreak) {
    if (side === 'A') set.tieBreak.pointsA += 1;
    else set.tieBreak.pointsB += 1;

    const winner = tieBreakWon(
      set.tieBreak.pointsA,
      set.tieBreak.pointsB,
      config.tieBreak.pointsTo,
      config.tieBreak.mustWinBy,
    );
    if (winner) {
      if (winner === 'A') set.gamesA += 1;
      else set.gamesB += 1;
      completeSet(next, set, winner);
    }
    return next;
  }

  // Regular game scoring
  if (!set.game) {
    set.game = emptyGame();
  }

  const { game, gameWonBy } = applyGamePoint(set.game, side, config.deuceMode);
  set.game = game;

  if (!gameWonBy) {
    return next;
  }

  if (gameWonBy === 'A') set.gamesA += 1;
  else set.gamesB += 1;
  set.game = emptyGame();

  // Check if set won by games
  const setWinner = setWonBySide(set.gamesA, set.gamesB, config);
  if (setWinner) {
    completeSet(next, set, setWinner);
    return next;
  }

  // Enter set tie-break when both reach atGames
  if (isSetTieBreakTrigger(set.gamesA, set.gamesB, config)) {
    set.game = null;
    set.tieBreak = { pointsA: 0, pointsB: 0 };
  }

  return next;
}

export function isMatchComplete(state: ScoreState): boolean {
  return state.phase === 'completed' && state.winnerSide !== null;
}

export function getWinnerSide(state: ScoreState): Side | null {
  return state.winnerSide;
}

/** Display helper: map internal points 0..3+ to padel labels */
export function pointLabel(
  points: number,
  opponentPoints: number,
  deuceMode: ScoringConfig['deuceMode'],
  advantageSide: Side | null,
  side: Side,
): string {
  if (deuceMode === 'advantage' && points >= 3 && opponentPoints >= 3) {
    if (advantageSide === side) return 'AD';
    if (advantageSide === opposite(side)) return '40';
    return '40';
  }
  const labels = ['0', '15', '30', '40'];
  if (points <= 3) return labels[points];
  // Beyond 40 in golden / mid-deuce display
  return '40';
}
