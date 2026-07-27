export const PlayerEvents = {
  Created: 'player.created',
  Updated: 'player.updated',
  SoftDeleted: 'player.soft_deleted',
} as const;

export type PlayerEventName =
  (typeof PlayerEvents)[keyof typeof PlayerEvents];
