/**
 * Self-running unit checks for Playoff bracket generator + progression.
 * Run: npm run test:playoff
 */
import assert from 'node:assert/strict';
import { generatePlayoffBracket } from './playoff-bracket-generator';
import { generateKnockoutBracket } from './playoff-knockout-generator';
import { planPlayoffAdvancement } from './playoff-progression';
import { QualifiedSeed } from './playoff.types';

function seed(
  teamId: string,
  groupKey: string,
  rankPosition: number,
  groupId = `g-${groupKey}`,
): QualifiedSeed {
  return { teamId, groupId, groupKey, rankPosition };
}

function teams(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `s${i + 1}`,
    seed: i + 1,
  }));
}

// --- 2 groups × top 2 ---
{
  const result = generatePlayoffBracket({
    qualifyTop: 2,
    seeds: [
      seed('tA1', 'A', 1),
      seed('tA2', 'A', 2),
      seed('tB1', 'B', 1),
      seed('tB2', 'B', 2),
    ],
  });
  assert.equal(result.materializable.length, 2);
  assert.equal(result.byeWinners.length, 0);

  let plan = planPlayoffAdvancement({
    structure: result.structure,
    verified: [
      { bracketPosition: 'SF1', winnerTeamId: 'tA1' },
      { bracketPosition: 'SF2', winnerTeamId: 'tB1' },
    ],
    materializedPositions: ['SF1', 'SF2'],
  });
  assert.equal(plan.create[0].bracketPosition, 'F');
}

// --- knockout_only: 4 teams (power of 2, no byes) ---
{
  const result = generateKnockoutBracket({ teams: teams(4) });
  assert.equal(result.structure.pairingMode, 'seeded_knockout');
  assert.equal(result.structure.bracketSize, 4);
  assert.equal(result.byeWinners.length, 0);
  assert.equal(result.materializable.length, 2);
  const sf1 = result.materializable.find((m) => m.bracketPosition === 'SF1');
  assert.equal(sf1?.teamAId, 's1');
  assert.equal(sf1?.teamBId, 's4');
}

// --- knockout_only: 2 teams ---
{
  const result = generateKnockoutBracket({ teams: teams(2) });
  assert.equal(result.structure.bracketSize, 2);
  assert.equal(result.materializable[0].bracketPosition, 'F');
  assert.equal(result.byeWinners.length, 0);
}

// --- knockout_only: 3 teams → bracket 4, seed1 bye ---
{
  const result = generateKnockoutBracket({ teams: teams(3) });
  assert.equal(result.structure.bracketSize, 4);
  assert.equal(result.structure.qualifyTop, 3);
  assert.equal(result.byeWinners.length, 1);
  assert.equal(result.byeWinners[0].bracketPosition, 'SF1');
  assert.equal(result.byeWinners[0].winnerTeamId, 's1');
  assert.equal(result.materializable.length, 1);
  assert.equal(result.materializable[0].bracketPosition, 'SF2');
  assert.equal(result.materializable[0].teamAId, 's2');
  assert.equal(result.materializable[0].teamBId, 's3');

  // Bye alone does not open Final
  const afterBye = planPlayoffAdvancement({
    structure: result.structure,
    verified: result.byeWinners,
    materializedPositions: ['SF2'],
  });
  assert.equal(afterBye.create.length, 0);

  // After SF2 verified → Final
  const afterSf2 = planPlayoffAdvancement({
    structure: result.structure,
    verified: [
      ...result.byeWinners,
      { bracketPosition: 'SF2', winnerTeamId: 's2' },
    ],
    materializedPositions: ['SF2'],
  });
  assert.equal(afterSf2.create.length, 1);
  assert.equal(afterSf2.create[0].bracketPosition, 'F');
  assert.equal(afterSf2.create[0].teamAId, 's1');
  assert.equal(afterSf2.create[0].teamBId, 's2');
}

// --- knockout_only: 5 teams → bracket 8; top 3 bye; only 4v5 is played ---
{
  const result = generateKnockoutBracket({ teams: teams(5) });
  assert.equal(result.structure.bracketSize, 8);
  assert.equal(result.byeWinners.length, 3);
  assert.deepEqual(
    result.byeWinners.map((b) => b.winnerTeamId).sort(),
    ['s1', 's2', 's3'],
  );
  assert.equal(result.materializable.length, 1);
  assert.equal(result.materializable[0].bracketPosition, 'QF2');
  assert.equal(result.materializable[0].teamAId, 's4');
  assert.equal(result.materializable[0].teamBId, 's5');

  // s2 vs s3 is fully known from byes; s1's semi-final waits for QF2
  const followUp = planPlayoffAdvancement({
    structure: result.structure,
    verified: result.byeWinners,
    materializedPositions: result.materializable.map((m) => m.bracketPosition),
  });
  assert.equal(followUp.create.length, 1);
  assert.equal(followUp.create[0].bracketPosition, 'SF2');
  assert.equal(followUp.create[0].teamAId, 's2');
  assert.equal(followUp.create[0].teamBId, 's3');
}

// --- knockout_only: 6 teams → byes for s1/s2, both semi-finals wait ---
{
  const result = generateKnockoutBracket({ teams: teams(6) });
  assert.equal(result.structure.bracketSize, 8);
  assert.equal(result.byeWinners.length, 2);
  assert.deepEqual(
    result.byeWinners.map((b) => b.winnerTeamId).sort(),
    ['s1', 's2'],
  );
  assert.equal(result.materializable.length, 2);
  const followUp = planPlayoffAdvancement({
    structure: result.structure,
    verified: result.byeWinners,
    materializedPositions: result.materializable.map((m) => m.bracketPosition),
  });
  assert.equal(followUp.create.length, 0);
}

// --- knockout_only: 7 teams ---
{
  const result = generateKnockoutBracket({ teams: teams(7) });
  assert.equal(result.structure.bracketSize, 8);
  assert.equal(result.byeWinners.length, 1);
  assert.equal(result.byeWinners[0].winnerTeamId, 's1');
  assert.equal(result.materializable.length, 3);
  const followUp = planPlayoffAdvancement({
    structure: result.structure,
    verified: result.byeWinners,
    materializedPositions: result.materializable.map((m) => m.bracketPosition),
  });
  assert.equal(followUp.create.length, 0);
}

// --- knockout_only: seeds 1 and 2 may only meet in the Final (all sizes) ---
{
  for (const n of [4, 5, 6, 7, 8, 9, 12, 16]) {
    const result = generateKnockoutBracket({ teams: teams(n) });
    const structure = result.structure;

    // Walk the bracket to find which final-round side each seed feeds into.
    const half = new Map<string, 'A' | 'B'>();
    const final = structure.matches.find((m) => m.bracketPosition === 'F');
    assert.ok(final, `bracket of ${n} has no Final`);

    const collect = (position: string, side: 'A' | 'B') => {
      const match = structure.matches.find(
        (m) => m.bracketPosition === position,
      );
      assert.ok(match, `missing match ${position}`);
      for (const entry of [match.sideA, match.sideB]) {
        if (entry.kind === 'seed') {
          half.set(entry.teamId, side);
        } else if (entry.kind === 'winner_of') {
          collect(entry.bracketPosition, side);
        }
      }
    };

    if (final.sideA.kind === 'winner_of') {
      collect(final.sideA.bracketPosition, 'A');
    } else if (final.sideA.kind === 'seed') {
      half.set(final.sideA.teamId, 'A');
    }
    if (final.sideB.kind === 'winner_of') {
      collect(final.sideB.bracketPosition, 'B');
    } else if (final.sideB.kind === 'seed') {
      half.set(final.sideB.teamId, 'B');
    }

    assert.notEqual(
      half.get('s1'),
      half.get('s2'),
      `bracket of ${n}: seeds 1 and 2 share a half`,
    );
  }
}

// --- knockout_only: reject <2 and >16 ---
{
  assert.throws(() => generateKnockoutBracket({ teams: teams(1) }));
  assert.throws(() => generateKnockoutBracket({ teams: teams(17) }));
}

console.log('playoff-bracket-generator.spec: all assertions passed');
