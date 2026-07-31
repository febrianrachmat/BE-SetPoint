import {
  DEFAULT_MATCH_DURATION_MINUTES,
  DEFAULT_REST_BUFFER_MINUTES,
  DEFAULT_SCHEDULE_STRATEGY,
  ScheduleStrategy,
  SCHEDULE_STRATEGY_GROUP_BLOCK,
  SCHEDULE_STRATEGY_ROUND_WAVE,
} from './schedule-engine.constants';
import { generateRoundRobinPairs } from './round-robin';
import {
  AssignedMatch,
  assignCourtsAndTimesGroupBlock,
  assignCourtsAndTimesRoundWave,
  CourtInput,
} from './schedule-assigner';

export type ScheduleGroupInput = {
  groupId: string;
  teamIds: string[];
};

export type GenerateSchedulePlanInput = {
  groups: ScheduleGroupInput[];
  courts: CourtInput[];
  startAt: Date;
  matchDurationMinutes?: number;
  restBufferMinutes?: number;
  strategy?: ScheduleStrategy;
};

export type GenerateSchedulePlanResult = {
  matches: AssignedMatch[];
  matchDurationMinutes: number;
  restBufferMinutes: number;
  strategy: ScheduleStrategy;
  conflictStatus: 'clear';
};

export function generateSchedulePlan(
  input: GenerateSchedulePlanInput,
): GenerateSchedulePlanResult {
  if (input.groups.length < 1) {
    throw new Error('Official Drawing must contain at least one Group');
  }

  const planned: Array<{
    groupId: string;
    teamAId: string;
    teamBId: string;
    round: number;
  }> = [];
  for (const group of input.groups) {
    if (group.teamIds.length < 2) {
      throw new Error(
        `Group ${group.groupId} needs at least 2 teams to schedule matches`,
      );
    }
    const pairs = generateRoundRobinPairs(group.teamIds);
    for (const pair of pairs) {
      planned.push({
        groupId: group.groupId,
        teamAId: pair.teamAId,
        teamBId: pair.teamBId,
        round: pair.round,
      });
    }
  }

  if (planned.length < 1) {
    throw new Error('No matches could be generated from official Groups');
  }

  const matchDurationMinutes =
    input.matchDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
  const restBufferMinutes =
    input.restBufferMinutes ?? DEFAULT_REST_BUFFER_MINUTES;
  const strategy = input.strategy ?? DEFAULT_SCHEDULE_STRATEGY;

  if (
    strategy !== SCHEDULE_STRATEGY_GROUP_BLOCK &&
    strategy !== SCHEDULE_STRATEGY_ROUND_WAVE
  ) {
    throw new Error(
      `Unknown schedule strategy '${String(strategy)}'`,
    );
  }

  const assignInput = {
    matches: planned,
    courts: input.courts,
    startAt: input.startAt,
    matchDurationMinutes,
    restBufferMinutes,
  };

  const matches =
    strategy === SCHEDULE_STRATEGY_GROUP_BLOCK
      ? assignCourtsAndTimesGroupBlock(assignInput)
      : assignCourtsAndTimesRoundWave(assignInput);

  return {
    matches,
    matchDurationMinutes,
    restBufferMinutes,
    strategy,
    conflictStatus: 'clear',
  };
}
