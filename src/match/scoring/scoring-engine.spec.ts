/**
 * Self-running unit checks for the pure padel scoring engine.
 * Run: npm run test:scoring
 */
import assert from 'node:assert/strict';
import {
  adjustGame,
  adjustSet,
  applyPoint,
  createInitialState,
  getMatchResult,
  isMatchComplete,
  removePoint,
  setServerSide,
} from './scoring-engine';
import { resolveScoringConfig } from './scoring.config';
import { getScoringTemplate } from './scoring.templates';
import { ScoreState, ScoringConfig, Side } from './scoring.types';

function cfg(id: string): ScoringConfig {
  const t = getScoringTemplate(id);
  assert.ok(t, `missing template ${id}`);
  return t!;
}

function winGame(state: ScoreState, side: Side): ScoreState {
  // From 0-0: four points wins under both GP and advantage (no deuce).
  let next = state;
  for (let i = 0; i < 4; i += 1) {
    next = applyPoint(next, side);
  }
  return next;
}

function winGames(state: ScoreState, side: Side, count: number): ScoreState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    next = winGame(next, side);
  }
  return next;
}

// --- resolve config: default + legacy string ---
{
  const fromEmpty = resolveScoringConfig({});
  assert.equal(fromEmpty.templateId, 'one_set_6_gp_tb5');

  const legacy = resolveScoringConfig({ scoring: 'best_of_3' });
  assert.equal(legacy.templateId, 'best_of_3_gp_full');

  const override = resolveScoringConfig({
    scoring: {
      templateId: 'one_set_6_gp_tb5',
      gamesTo: 4,
      tieBreak: { atGames: 3, pointsTo: 7, mustWinBy: 2 },
    },
  });
  assert.equal(override.gamesTo, 4);
  assert.equal(override.tieBreak.atGames, 3);
}

// --- golden point game ---
{
  let s = createInitialState(cfg('one_set_6_gp_tb5'));
  s = applyPoint(s, 'A');
  s = applyPoint(s, 'A');
  s = applyPoint(s, 'A');
  assert.equal(s.sets[0].game?.pointsA, 3);
  s = applyPoint(s, 'B');
  s = applyPoint(s, 'B');
  s = applyPoint(s, 'B');
  assert.equal(s.sets[0].game?.pointsA, 3);
  assert.equal(s.sets[0].game?.pointsB, 3);
  s = applyPoint(s, 'A'); // golden point
  assert.equal(s.sets[0].gamesA, 1);
  assert.equal(s.sets[0].gamesB, 0);
  assert.equal(s.sets[0].game?.pointsA, 0);
}

// --- advantage game ---
{
  let s = createInitialState(cfg('best_of_3_advantage_full'));
  // Reach deuce 40-40
  for (let i = 0; i < 3; i += 1) s = applyPoint(s, 'A');
  for (let i = 0; i < 3; i += 1) s = applyPoint(s, 'B');
  s = applyPoint(s, 'A'); // Ad A
  assert.equal(s.sets[0].game?.advantageSide, 'A');
  s = applyPoint(s, 'B'); // back to deuce
  assert.equal(s.sets[0].game?.advantageSide, null);
  s = applyPoint(s, 'B'); // Ad B
  s = applyPoint(s, 'B'); // game B
  assert.equal(s.sets[0].gamesB, 1);
}

// --- one-set: 6-4 straight ---
{
  let s = createInitialState(cfg('one_set_6_gp_tb5'));
  for (let g = 0; g < 4; g += 1) {
    s = winGame(s, 'A');
    s = winGame(s, 'B');
  }
  s = winGame(s, 'A');
  s = winGame(s, 'A'); // 6-4
  assert.equal(isMatchComplete(s), true);
  assert.equal(s.winnerSide, 'A');
  assert.equal(s.setsWon.A, 1);
}

// --- one-set TB at 5-5 → first to 7 ---
{
  let s = createInitialState(cfg('one_set_6_gp_tb5'));
  for (let g = 0; g < 5; g += 1) {
    s = winGame(s, 'A');
    s = winGame(s, 'B');
  }
  assert.ok(s.sets[0].tieBreak, 'should enter set TB at 5-5');
  assert.equal(s.sets[0].game, null);
  for (let i = 0; i < 7; i += 1) {
    s = applyPoint(s, 'A');
  }
  assert.equal(isMatchComplete(s), true);
  assert.equal(s.winnerSide, 'A');
  assert.equal(s.sets[0].gamesA, 6);
  assert.equal(s.sets[0].gamesB, 5);
}

// --- one-set gamesTo 4, TB at 3 ---
{
  let s = createInitialState(cfg('one_set_4_gp_tb3'));
  for (let g = 0; g < 3; g += 1) {
    s = winGame(s, 'A');
    s = winGame(s, 'B');
  }
  assert.ok(s.sets[0].tieBreak);
  for (let i = 0; i < 7; i += 1) s = applyPoint(s, 'B');
  assert.equal(s.winnerSide, 'B');
}

// --- Bo3 full deciding: win 2-0 ---
{
  let s = createInitialState(cfg('best_of_3_gp_full'));
  // Set 1: 6-0 A
  s = winGames(s, 'A', 6);
  assert.equal(s.setsWon.A, 1);
  assert.equal(s.sets.length, 2);
  // Set 2: 6-0 A
  s = winGames(s, 'A', 6);
  assert.equal(isMatchComplete(s), true);
  assert.equal(s.winnerSide, 'A');
  assert.equal(s.setsWon.A, 2);
}

// --- Bo3 match TB deciding ---
{
  let s = createInitialState(cfg('best_of_3_gp_match_tb'));
  s = winGames(s, 'A', 6);
  s = winGames(s, 'B', 6);
  assert.equal(s.setsWon.A, 1);
  assert.equal(s.setsWon.B, 1);
  assert.equal(s.sets.length, 3);
  assert.equal(s.sets[2].isMatchTieBreak, true);
  for (let i = 0; i < 10; i += 1) s = applyPoint(s, 'A');
  assert.equal(isMatchComplete(s), true);
  assert.equal(s.winnerSide, 'A');
  assert.equal(s.setsWon.A, 2);
}

// --- completed match rejects further points ---
{
  let s = createInitialState(cfg('one_set_6_gp_tb5'));
  s = winGames(s, 'A', 6);
  assert.throws(() => applyPoint(s, 'A'));
}

// --- Bo3 set TB at 6-6 ---
{
  let s = createInitialState(cfg('best_of_3_gp_full'));
  for (let g = 0; g < 6; g += 1) {
    s = winGame(s, 'A');
    s = winGame(s, 'B');
  }
  assert.ok(s.sets[0].tieBreak);
  for (let i = 0; i < 7; i += 1) s = applyPoint(s, 'B');
  assert.equal(s.setsWon.B, 1);
  assert.equal(s.phase, 'in_progress');
}

// --- getMatchResult from completed Bo3 ---
{
  let s = createInitialState(cfg('best_of_3_gp_full'));
  s = winGames(s, 'A', 6);
  s = winGames(s, 'B', 6);
  s = winGames(s, 'A', 6);
  const result = getMatchResult(s);
  assert.equal(result.winnerSide, 'A');
  assert.equal(result.loserSide, 'B');
  assert.deepEqual(result.setsWon, { A: 2, B: 1 });
  assert.deepEqual(result.sets, [
    [6, 0],
    [0, 6],
    [6, 0],
  ]);
  assert.throws(() => getMatchResult(createInitialState(cfg('one_set_6_gp_tb5'))));
}

// --- removePoint corrects mis-tap ---
{
  let s = createInitialState(cfg('one_set_4_gp_tb3'));
  s = applyPoint(s, 'A');
  s = applyPoint(s, 'A');
  s = removePoint(s, 'A');
  assert.equal(s.sets[0].game?.pointsA, 1);
  assert.throws(() => removePoint(s, 'B'));
}

// --- adjustGame ± and server rotation ---
{
  let s = createInitialState(cfg('one_set_4_gp_tb3'));
  assert.equal(s.serverSide, 'A');
  s = adjustGame(s, 'A', 1);
  assert.equal(s.sets[0].gamesA, 1);
  assert.equal(s.serverSide, 'B');
  s = adjustGame(s, 'A', -1);
  assert.equal(s.sets[0].gamesA, 0);
}

// --- adjustSet ± ---
{
  let s = createInitialState(cfg('best_of_3_gp_full'));
  s = adjustSet(s, 'A', 1);
  assert.equal(s.setsWon.A, 1);
  assert.equal(s.sets.length, 2);
  s = adjustSet(s, 'A', -1);
  assert.equal(s.setsWon.A, 0);
  assert.equal(s.sets.length, 1);
  assert.equal(s.phase, 'in_progress');
}

// --- setServerSide ---
{
  let s = createInitialState(cfg('one_set_4_gp_tb3'));
  s = setServerSide(s, 'B');
  assert.equal(s.serverSide, 'B');
}

console.log('scoring-engine.spec: all assertions passed');
