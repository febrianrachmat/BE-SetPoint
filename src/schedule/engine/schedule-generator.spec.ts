/**
 * Self-running unit checks for Schedule engine.
 * Run: npm run test:schedule
 */
import assert from 'node:assert/strict';
import { generateRoundRobinPairs } from './round-robin';
import { generateSchedulePlan } from './schedule-generator';

{
  const pairs = generateRoundRobinPairs(['t1', 't2', 't3', 't4']);
  // 4 teams → 6 matches, 3 rounds, 2 per round
  assert.equal(pairs.length, 6);
  const byRound = new Map<number, typeof pairs>();
  for (const pair of pairs) {
    const list = byRound.get(pair.round) ?? [];
    list.push(pair);
    byRound.set(pair.round, list);
  }
  assert.equal(byRound.size, 3);
  for (const roundPairs of byRound.values()) {
    assert.equal(roundPairs.length, 2);
    const teams = new Set(
      roundPairs.flatMap((p) => [p.teamAId, p.teamBId]),
    );
    assert.equal(teams.size, 4);
  }
}

{
  const plan = generateSchedulePlan({
    groups: [
      { groupId: 'gA', teamIds: ['a1', 'a2', 'a3', 'a4'] },
      { groupId: 'gB', teamIds: ['b1', 'b2', 'b3', 'b4'] },
    ],
    courts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }],
    startAt: new Date('2026-08-01T08:00:00.000Z'),
    matchDurationMinutes: 90,
  });

  assert.equal(plan.matches.length, 12); // 6 + 6
  assert.equal(plan.conflictStatus, 'clear');

  // first wave (round 1): 2 matches per group = 4 parallel on 4 courts
  const round1 = plan.matches.filter((m) => m.round === 1);
  assert.equal(round1.length, 4);
  const starts = new Set(round1.map((m) => m.scheduledStartAt.toISOString()));
  assert.equal(starts.size, 1);
}

{
  assert.throws(() =>
    generateSchedulePlan({
      groups: [{ groupId: 'gA', teamIds: ['a1'] }],
      courts: [{ id: 'c1' }],
      startAt: new Date(),
    }),
  );
}

console.log('schedule-generator unit checks passed');
