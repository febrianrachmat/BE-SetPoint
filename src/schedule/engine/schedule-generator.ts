import { DEFAULT_MATCH_DURATION_MINUTES } from './schedule-engine.constants';
import { generateRoundRobinPairs } from './round-robin';
import {
  AssignedMatch,
  assignCourtsAndTimes,
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
};

export type GenerateSchedulePlanResult = {
  matches: AssignedMatch[];
  matchDurationMinutes: number;
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

  const matches = assignCourtsAndTimes({
    matches: planned,
    courts: input.courts,
    startAt: input.startAt,
    matchDurationMinutes,
  });

  return {
    matches,
    matchDurationMinutes,
    conflictStatus: 'clear',
  };
}
