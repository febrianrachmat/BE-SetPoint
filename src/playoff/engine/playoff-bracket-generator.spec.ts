/**
 * Self-running unit checks for Playoff bracket generator.
 * Run: npm run test:playoff
 */
import assert from 'node:assert/strict';
import { generatePlayoffBracket } from './playoff-bracket-generator';
import { QualifiedSeed } from './playoff.types';

function seed(
  teamId: string,
  groupKey: string,
  rankPosition: number,
  groupId = `g-${groupKey}`,
): QualifiedSeed {
  return { teamId, groupId, groupKey, rankPosition };
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
  assert.equal(result.structure.matches.length, 3);

  const sf1 = result.materializable.find((m) => m.bracketPosition === 'SF1');
  const sf2 = result.materializable.find((m) => m.bracketPosition === 'SF2');
  assert.ok(sf1 && sf2);
  assert.equal(sf1.teamAId, 'tA1');
  assert.equal(sf1.teamBId, 'tB2');
  assert.equal(sf2.teamAId, 'tB1');
  assert.equal(sf2.teamBId, 'tA2');

  const final = result.structure.matches.find((m) => m.bracketPosition === 'F');
  assert.equal(final?.materialize, false);
  assert.equal(final?.sideA.kind, 'winner_of');
}

// --- 1 group × top 2 → Final only ---
{
  const result = generatePlayoffBracket({
    qualifyTop: 2,
    seeds: [seed('t1', 'A', 1), seed('t2', 'A', 2)],
  });
  assert.equal(result.materializable.length, 1);
  assert.equal(result.materializable[0].bracketPosition, 'F');
  assert.equal(result.materializable[0].teamAId, 't1');
  assert.equal(result.materializable[0].teamBId, 't2');
}

// --- rejects missing seeds ---
{
  assert.throws(() =>
    generatePlayoffBracket({
      qualifyTop: 2,
      seeds: [seed('tA1', 'A', 1), seed('tB1', 'B', 1)],
    }),
  );
}

console.log('playoff-bracket-generator.spec: all assertions passed');
