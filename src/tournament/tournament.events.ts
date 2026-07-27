export const TournamentEvents = {
  Created: 'tournament.created',
  Updated: 'tournament.updated',
  SoftDeleted: 'tournament.soft_deleted',
  MovedToSetup: 'tournament.moved_to_setup',
  Published: 'tournament.published',
  WentLive: 'tournament.went_live',
  Finished: 'tournament.finished',
  Archived: 'tournament.archived',
} as const;

export type TournamentLifecycleEventName =
  (typeof TournamentEvents)[keyof typeof TournamentEvents];
