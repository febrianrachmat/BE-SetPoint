export const CourtEvents = {
  Created: 'court.created',
  Updated: 'court.updated',
  Enabled: 'court.enabled',
  Disabled: 'court.disabled',
  Reordered: 'court.reordered',
  SoftDeleted: 'court.soft_deleted',
} as const;

export type CourtEventName = (typeof CourtEvents)[keyof typeof CourtEvents];
