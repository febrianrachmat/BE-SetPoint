export const PlayoffEvents = {
  Ensured: 'playoff.ensured',
  BracketGenerated: 'playoff.bracket.generated',
  BracketReviewed: 'playoff.bracket.reviewed',
  Published: 'playoff.published',
  Locked: 'playoff.locked',
  Unlocked: 'playoff.unlocked',
} as const;

export type PlayoffEventName =
  (typeof PlayoffEvents)[keyof typeof PlayoffEvents];
