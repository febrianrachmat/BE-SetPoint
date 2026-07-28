export const StandingEvents = {
  Recalculated: 'standing.recalculated',
} as const;

export type StandingEventName =
  (typeof StandingEvents)[keyof typeof StandingEvents];
