export const CategoryEvents = {
  Created: 'category.created',
  Updated: 'category.updated',
  SoftDeleted: 'category.soft_deleted',
} as const;

export type CategoryEventName =
  (typeof CategoryEvents)[keyof typeof CategoryEvents];
