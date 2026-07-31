export const SCHEDULE_ENGINE_VERSION = 'schedule-engine-v1';

export const DEFAULT_MATCH_DURATION_MINUTES = 90;

export const DEFAULT_REST_BUFFER_MINUTES = 0;

/** One court finishes a group before taking another group. */
export const SCHEDULE_STRATEGY_GROUP_BLOCK = 'group_block';

/** Global round waves across groups (legacy). */
export const SCHEDULE_STRATEGY_ROUND_WAVE = 'round_wave';

export type ScheduleStrategy =
  | typeof SCHEDULE_STRATEGY_GROUP_BLOCK
  | typeof SCHEDULE_STRATEGY_ROUND_WAVE;

export const DEFAULT_SCHEDULE_STRATEGY: ScheduleStrategy =
  SCHEDULE_STRATEGY_GROUP_BLOCK;
