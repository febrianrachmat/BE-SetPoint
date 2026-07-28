export const MatchEvents = {
  WarmedUp: 'match.warmed_up',
  Started: 'match.started',
  ScoreUpdated: 'match.score.updated',
  Finished: 'match.finished',
  Verified: 'match.verified',
} as const;

export type MatchEventName = (typeof MatchEvents)[keyof typeof MatchEvents];
