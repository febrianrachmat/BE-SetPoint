/**
 * Self-running unit checks for Schedule engine.
 * Run: npm run test:schedule
 */
import assert from 'node:assert/strict';
import { generateRoundRobinPairs } from './round-robin';
import { generateSchedulePlan } from './schedule-generator';
import {
  SCHEDULE_STRATEGY_GROUP_BLOCK,
  SCHEDULE_STRATEGY_ROUND_WAVE,
} from './schedule-engine.constants';

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
    strategy: SCHEDULE_STRATEGY_ROUND_WAVE,
  });

  assert.equal(plan.matches.length, 12); // 6 + 6
  assert.equal(plan.conflictStatus, 'clear');
  assert.equal(plan.strategy, SCHEDULE_STRATEGY_ROUND_WAVE);

  // first wave (round 1): 2 matches per group = 4 parallel on 4 courts
  const round1 = plan.matches.filter((m) => m.round === 1);
  assert.equal(round1.length, 4);
  const starts = new Set(round1.map((m) => m.scheduledStartAt.toISOString()));
  assert.equal(starts.size, 1);
}

{
  // Default strategy is group_block: 4 groups on 4 courts → 1 court per group
  const plan = generateSchedulePlan({
    groups: [
      { groupId: 'gA', teamIds: ['a1', 'a2', 'a3', 'a4'] },
      { groupId: 'gB', teamIds: ['b1', 'b2', 'b3', 'b4'] },
      { groupId: 'gC', teamIds: ['c1', 'c2', 'c3', 'c4'] },
      { groupId: 'gD', teamIds: ['d1', 'd2', 'd3', 'd4'] },
    ],
    courts: [{ id: 'court1' }, { id: 'court2' }, { id: 'court3' }, { id: 'court4' }],
    startAt: new Date('2026-08-01T08:00:00.000Z'),
    matchDurationMinutes: 30,
    restBufferMinutes: 0,
  });

  assert.equal(plan.strategy, SCHEDULE_STRATEGY_GROUP_BLOCK);
  assert.equal(plan.matches.length, 24);

  const courtsByGroup = new Map<string, Set<string>>();
  for (const match of plan.matches) {
    const set = courtsByGroup.get(match.groupId) ?? new Set<string>();
    set.add(match.courtId);
    courtsByGroup.set(match.groupId, set);
  }
  for (const courts of courtsByGroup.values()) {
    assert.equal(courts.size, 1, 'each group stays on one court');
  }

  // All groups start together on distinct courts
  const firstSlot = plan.matches.filter(
    (m) => m.scheduledStartAt.toISOString() === '2026-08-01T08:00:00.000Z',
  );
  assert.equal(firstSlot.length, 4);
  assert.equal(new Set(firstSlot.map((m) => m.courtId)).size, 4);
}

{
  // More groups than courts: finished court pulls the next waiting group
  const plan = generateSchedulePlan({
    groups: [
      { groupId: 'gA', teamIds: ['a1', 'a2', 'a3', 'a4'] },
      { groupId: 'gB', teamIds: ['b1', 'b2', 'b3', 'b4'] },
      { groupId: 'gC', teamIds: ['c1', 'c2', 'c3', 'c4'] },
    ],
    courts: [{ id: 'court1' }, { id: 'court2' }],
    startAt: new Date('2026-08-01T08:00:00.000Z'),
    matchDurationMinutes: 30,
    strategy: SCHEDULE_STRATEGY_GROUP_BLOCK,
  });

  assert.equal(plan.matches.length, 18);
  const groupC = plan.matches.filter((m) => m.groupId === 'gC');
  assert.equal(groupC.length, 6);
  // Group C cannot start at t0 — only 2 courts for A/B first
  assert.ok(
    groupC.every(
      (m) => m.scheduledStartAt.toISOString() > '2026-08-01T08:00:00.000Z',
    ),
  );
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
