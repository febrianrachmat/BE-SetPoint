export const ScheduleEvents = {
  Ensured: 'schedule.ensured',
  VersionGenerated: 'schedule.version_generated',
  VersionReviewed: 'schedule.version_reviewed',
  Published: 'schedule.published',
  Locked: 'schedule.locked',
  Unlocked: 'schedule.unlocked',
} as const;

export type ScheduleEventName =
  (typeof ScheduleEvents)[keyof typeof ScheduleEvents];
