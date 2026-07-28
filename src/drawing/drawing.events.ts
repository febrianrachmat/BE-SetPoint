export const DrawingEvents = {
  Ensured: 'drawing.ensured',
  VersionGenerated: 'drawing.version_generated',
  VersionReviewed: 'drawing.version_reviewed',
  Published: 'drawing.published',
  Locked: 'drawing.locked',
  Unlocked: 'drawing.unlocked',
} as const;

export type DrawingEventName =
  (typeof DrawingEvents)[keyof typeof DrawingEvents];
