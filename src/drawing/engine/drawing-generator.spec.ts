/**
 * Self-running unit checks for the pure Drawing generator.
 * Run: npm run test:drawing
 */
import assert from 'node:assert/strict';
import { PlacementMode } from './drawing-engine.constants';
import { generateDrawingPlacements } from './drawing-generator';
import {
  assertExactPartition,
  parseGroupPartitionConfig,
} from './group-partition';
import { seededShuffle } from './seeded-prng';
import { snakeDraftAllocate } from './snake-draft';

function teams(n: number, withRank = false) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${String(i + 1).padStart(2, '0')}`,
    seedRank: withRank ? i + 1 : null,
  }));
}

function config(groupCount: number, teamsPerGroup: number) {
  return { teamSize: 2, groupCount, teamsPerGroup };
}

// --- partition ---
{
  const p = parseGroupPartitionConfig(config(2, 4));
  assert.equal(p.groupCount, 2);
  assert.equal(p.teamsPerGroup, 4);
  assert.doesNotThrow(() => assertExactPartition(8, p));
  assert.throws(() => assertExactPartition(7, p));
}

// --- RANDOM reproducibility ---
{
  const eligible = teams(8);
  const a = generateDrawingPlacements({
    configuration: config(2, 4),
    eligibleTeams: eligible,
    placementMode: PlacementMode.random,
    drawingSeed: 'demo-seed-1',
  });
  const b = generateDrawingPlacements({
    configuration: config(2, 4),
    eligibleTeams: eligible,
    placementMode: PlacementMode.random,
    drawingSeed: 'demo-seed-1',
  });
  assert.deepEqual(
    a.groups.map((g) => g.members.map((m) => m.teamId)),
    b.groups.map((g) => g.members.map((m) => m.teamId)),
  );
  assert.equal(a.prngAlgorithm, 'mulberry32-v1');
  assert.equal(a.engineVersion, 'drawing-engine-v1');

  const c = generateDrawingPlacements({
    configuration: config(2, 4),
    eligibleTeams: eligible,
    placementMode: PlacementMode.random,
    drawingSeed: 'demo-seed-2',
  });
  assert.notDeepEqual(
    a.groups.map((g) => g.members.map((m) => m.teamId)),
    c.groups.map((g) => g.members.map((m) => m.teamId)),
  );
}

// --- shuffle stability ---
{
  assert.deepEqual(
    seededShuffle(['a', 'b', 'c', 'd'], 'x'),
    seededShuffle(['a', 'b', 'c', 'd'], 'x'),
  );
}

// --- SEEDED snake 8 → 2×4 ---
{
  const result = generateDrawingPlacements({
    configuration: config(2, 4),
    eligibleTeams: teams(8, true),
    placementMode: PlacementMode.seeded,
    drawingSeed: 'unused-for-placement',
  });
  assert.equal(result.prngAlgorithm, null);
  // snake into 2 groups: 1A 2B 3B 4A 5A 6B 7B 8A
  // Wait - with 2 groups: 1→A, 2→B, then at B reverse: 3→B? Let's check algorithm.

  // groupIndex starts 0, direction 1:
  // 1 → A (0), move to 1
  // 2 → B (1), at last → direction -1 (stay? my impl: after placing at last, direction=-1, next iter places at same index then decreases)

  // Looking at my snakeDraftAllocate:
  // After placing at groupCount-1, direction = -1, but groupIndex stays at last
  // Next item also goes to last group, THEN groupIndex decreases.
  // That's WRONG for classic snake!

  // Classic snake for 2 groups:
  // 1→A, 2→B, 3→B, 4→A, 5→A, 6→B, 7→B, 8→A
  // Or: 1→A, 2→B, 3→A, 4→B... (round robin) - different

  // True snake: when you hit the end, reverse WITHOUT placing twice at end on turn.
  // Standard:
  // indices cycle: 0,1,2,3,3,2,1,0,0,1,...
  // After placing at 3, next is 3 again? In serpentine for drafts:
  // Round 1 L→R: A B C D
  // Round 2 R→L: D C B A
  // So after D in round 1, next is D in round 2. Yes! Two consecutive to same group at the turnaround.

  // For 2 groups: 1A, 2B, 3B, 4A, 5A, 6B, 7B, 8A
  assert.deepEqual(
    result.groups.map((g) => g.members.map((m) => m.teamId)),
    [
      ['t01', 't04', 't05', 't08'], // A
      ['t02', 't03', 't06', 't07'], // B
    ],
  );
}

// --- SEEDED snake 16 → 4×4 ---
{
  const allocated = snakeDraftAllocate(
    teams(16, true).map((t) => t.id),
    4,
  );
  assert.equal(allocated.length, 4);
  assert.ok(allocated.every((g) => g.length === 4));
  // first round A B C D
  assert.equal(allocated[0]![0], 't01');
  assert.equal(allocated[1]![0], 't02');
  assert.equal(allocated[2]![0], 't03');
  assert.equal(allocated[3]![0], 't04');
  // turnaround: t05 also to D
  assert.equal(allocated[3]![1], 't05');
}

// --- SEEDED rejects missing ranks ---
{
  assert.throws(() =>
    generateDrawingPlacements({
      configuration: config(2, 4),
      eligibleTeams: teams(8, false),
      placementMode: PlacementMode.seeded,
      drawingSeed: 'x',
    }),
  );
}

console.log('drawing-generator unit checks passed');
