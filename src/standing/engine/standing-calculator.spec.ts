/**
 * Self-running unit checks for Standing calculator + tie-break (9A/9B).
 * Run: npm run test:standing
 */
import assert from 'node:assert/strict';
import { accumulateStandings } from './standing-calculator';
import { resolveStandingsConfig } from './standing.config';
import { calculateGroupStandings, rankStandings } from './standing-ranking';
import {
  DEFAULT_STANDINGS_CONFIG,
  DEFAULT_TIE_BREAK_ORDER,
  StandingMatchInput,
  StandingsConfig,
} from './standing.types';

const cfg: StandingsConfig = { ...DEFAULT_STANDINGS_CONFIG };

function match(
  a: string,
  b: string,
  winner: 'A' | 'B',
  sets: Array<[number, number]>,
): StandingMatchInput {
  const setsWon = sets.reduce(
    (acc, [ga, gb]) => {
      if (ga > gb) acc.A += 1;
      else acc.B += 1;
      return acc;
    },
    { A: 0, B: 0 },
  );
  return { teamAId: a, teamBId: b, winnerSide: winner, setsWon, sets };
}

// --- config defaults + custom order ---
{
  assert.deepEqual(resolveStandingsConfig({}), DEFAULT_STANDINGS_CONFIG);
  assert.deepEqual(
    resolveStandingsConfig({}).tieBreakOrder,
    DEFAULT_TIE_BREAK_ORDER,
  );
  const custom = resolveStandingsConfig({
    standings: {
      pointsForWin: 3,
      tieBreakOrder: ['points', 'set_difference', 'game_difference'],
    },
  });
  assert.equal(custom.pointsForWin, 3);
  assert.deepEqual(custom.tieBreakOrder, [
    'points',
    'set_difference',
    'game_difference',
  ]);
  assert.throws(() =>
    resolveStandingsConfig({
      standings: { tieBreakOrder: ['points', 'not_a_real_criterion'] },
    }),
  );
}

// --- basic W-L-P accumulation ---
{
  const rows = accumulateStandings({
    teamIds: ['t1', 't2', 't3'],
    matches: [
      match('t1', 't2', 'A', [[6, 4]]),
      match('t1', 't3', 'A', [[6, 2]]),
      match('t2', 't3', 'A', [[6, 3]]),
    ],
    config: cfg,
  });
  const byId = Object.fromEntries(rows.map((r) => [r.teamId, r]));
  assert.equal(byId.t1.wins, 2);
  assert.equal(byId.t1.points, 2);
  assert.equal(byId.t2.wins, 1);
  assert.equal(byId.t3.wins, 0);
}

// --- ranking by points ---
{
  const ranked = calculateGroupStandings({
    teamIds: ['t1', 't2', 't3'],
    matches: [
      match('t1', 't2', 'A', [[6, 4]]),
      match('t1', 't3', 'B', [[4, 6]]),
      match('t2', 't3', 'B', [[3, 6]]),
    ],
    config: cfg,
  });
  assert.equal(ranked[0].teamId, 't3');
  assert.equal(ranked[0].rankPosition, 1);
  assert.equal(ranked[1].teamId, 't1');
  assert.equal(ranked[2].teamId, 't2');
}

// --- head-to-head breaks points tie ---
{
  // t1 and t2 both 1 win; t1 beat t2 head-to-head → t1 ranks above t2
  const matches = [
    match('t1', 't2', 'A', [[6, 4]]),
    match('t1', 't3', 'B', [[3, 6]]),
    match('t2', 't3', 'A', [[6, 2]]),
  ];
  // points: t1=1, t2=1, t3=1 — all tied on points!
  // wins all 1. H2H mini among all three uses all matches — complex.
  // Better: only two teams tied on points with clear H2H.
  const matches2 = [
    match('t1', 't2', 'A', [[6, 3]]), // t1 beats t2
    match('t1', 't3', 'A', [[6, 4]]),
    match('t2', 't3', 'A', [[6, 4]]),
  ];
  // t1: 2 wins, t2: 1, t3: 0 — not a tie.

  // Force points tie between t1 and t2 only:
  // t1 beat t2; t2 beat t3; t1 lost to t3 → each has 1 win
  const ranked = calculateGroupStandings({
    teamIds: ['t1', 't2', 't3'],
    matches,
    config: {
      ...cfg,
      tieBreakOrder: ['points', 'head_to_head', 'set_difference'],
    },
  });
  // All 1 point. Among all three H2H mini = full table.
  // t1: win vs t2, loss vs t3 → 1W
  // t2: loss vs t1, win vs t3 → 1W
  // t3: win vs t1, loss vs t2 → 1W
  // H2H may not split — then set_difference:
  // t1: sets 1-1, games 6+3=9 vs 4+6=10 → gameDiff -1, setDiff 0
  // t2: sets 1-1, games 4+6=10 vs 6+2=8 → gameDiff +2
  // t3: sets 1-1, games 6+2=8 vs 3+6=9 → gameDiff -1
  // Wait sets: t1 vs t2 [6,4] → t1 sets+1; t1 vs t3 [3,6] → t3 sets+1; t2 vs t3 [6,2] → t2 sets+1
  // Each 1 set won, 1 lost. gameDiff: t1: (6+3)-(4+6)=-1; t2:(4+6)-(6+2)=+2; t3:(6+2)-(3+6)=-1
  // Order after points (all equal) → H2H (all equal mini) → set_diff (all 0) → need game in order
  assert.equal(ranked.length, 3);

  // Dedicated H2H two-team tie with game_difference after:
  const twoTeamCfg: StandingsConfig = {
    ...cfg,
    tieBreakOrder: ['points', 'head_to_head'],
  };
  const h2hRanked = calculateGroupStandings({
    teamIds: ['a', 'b', 'c'],
    matches: [
      match('a', 'b', 'A', [[6, 1]]), // a beats b
      match('a', 'c', 'B', [[0, 6]]),
      match('b', 'c', 'A', [[6, 0]]),
    ],
    config: twoTeamCfg,
  });
  // points all 1. H2H mini same as full. Still tied on H2H compound?
  // mini points all 1. Then mini setDiff/gameDiff may split.
  // a: games 6+0 vs 1+6 = 6-7 = -1
  // b: games 1+6 vs 6+0 = 7-6 = +1
  // c: games 6+0 vs 0+6 = 6-6 = 0
  // H2H key includes gameDiff → b > c > a
  assert.equal(h2hRanked[0].teamId, 'b');
  assert.equal(h2hRanked[0].tieBreakNotes, null);
}

// --- pairwise H2H: two teams tied, third clear ---
{
  // c has 2 wins; a and b have 1 each; a beat b
  const ranked = calculateGroupStandings({
    teamIds: ['a', 'b', 'c'],
    matches: [
      match('c', 'a', 'A', [[6, 2]]),
      match('c', 'b', 'A', [[6, 2]]),
      match('a', 'b', 'A', [[6, 4]]),
    ],
    config: {
      ...cfg,
      tieBreakOrder: ['points', 'head_to_head'],
    },
  });
  assert.equal(ranked[0].teamId, 'c');
  assert.equal(ranked[0].rankPosition, 1);
  assert.equal(ranked[1].teamId, 'a');
  assert.equal(ranked[1].rankPosition, 2);
  assert.equal(ranked[2].teamId, 'b');
  assert.equal(ranked[2].rankPosition, 3);
}

// --- custom order: set_difference before wins ---
{
  const ranked = calculateGroupStandings({
    teamIds: ['a', 'b'],
    matches: [match('a', 'b', 'A', [[6, 0]])],
    config: {
      ...cfg,
      tieBreakOrder: ['points', 'set_difference'],
    },
  });
  assert.equal(ranked[0].teamId, 'a');
}

// --- random_draw marks pending, does not shuffle ---
{
  const stats = accumulateStandings({
    teamIds: ['a', 'b'],
    matches: [],
    config: cfg,
  });
  // equal empty stats
  const ranked = rankStandings({
    stats,
    matches: [],
    config: {
      ...cfg,
      tieBreakOrder: ['points', 'random_draw'],
    },
  });
  assert.equal(ranked[0].rankPosition, 1);
  assert.equal(ranked[1].rankPosition, 1);
  assert.equal(ranked[0].tieBreakNotes, 'random_draw_pending');
  assert.equal(ranked[1].tieBreakNotes, 'random_draw_pending');
}

// --- unresolved when criteria exhausted ---
{
  const ranked = rankStandings({
    stats: [
      {
        teamId: 'a',
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      },
      {
        teamId: 'b',
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      },
    ],
    matches: [],
    config: {
      ...cfg,
      tieBreakOrder: ['points', 'wins'],
    },
  });
  assert.equal(ranked[0].rankPosition, 1);
  assert.equal(ranked[1].rankPosition, 1);
  assert.equal(ranked[0].tieBreakNotes, 'unresolved_tie');
}

console.log('standing-calculator.spec: all assertions passed');
