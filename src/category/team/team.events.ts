export const TeamEvents = {
  Registered: 'team.registered',
  Updated: 'team.updated',
  SoftDeleted: 'team.soft_deleted',
  Withdrawn: 'team.withdrawn',
  EligibilityChanged: 'team.eligibility_changed',
} as const;

export type TeamEventName = (typeof TeamEvents)[keyof typeof TeamEvents];
