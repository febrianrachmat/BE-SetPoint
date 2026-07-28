import {
  DEFAULT_STANDINGS_CONFIG,
  DEFAULT_TIE_BREAK_ORDER,
  StandingsConfig,
  TieBreakCriterion,
} from './standing.types';

const ALL_CRITERIA = new Set<TieBreakCriterion>([
  'points',
  'wins',
  'head_to_head',
  'set_difference',
  'sets_won',
  'game_difference',
  'random_draw',
]);

function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseTieBreakOrder(value: unknown): TieBreakCriterion[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_TIE_BREAK_ORDER];
  }

  const parsed: TieBreakCriterion[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !ALL_CRITERIA.has(item as TieBreakCriterion)) {
      throw new Error(`Invalid tieBreakOrder criterion: ${String(item)}`);
    }
    parsed.push(item as TieBreakCriterion);
  }
  return parsed;
}

/**
 * Resolve Category.configuration.standings (with defaults).
 */
export function resolveStandingsConfig(configuration: unknown): StandingsConfig {
  const root =
    configuration &&
    typeof configuration === 'object' &&
    !Array.isArray(configuration)
      ? (configuration as Record<string, unknown>)
      : {};

  const raw =
    root.standings &&
    typeof root.standings === 'object' &&
    !Array.isArray(root.standings)
      ? (root.standings as Record<string, unknown>)
      : {};

  const pointsForWin = isNonNegInt(raw.pointsForWin)
    ? raw.pointsForWin
    : DEFAULT_STANDINGS_CONFIG.pointsForWin;
  const pointsForLoss = isNonNegInt(raw.pointsForLoss)
    ? raw.pointsForLoss
    : DEFAULT_STANDINGS_CONFIG.pointsForLoss;

  return {
    pointsForWin,
    pointsForLoss,
    tieBreakOrder: parseTieBreakOrder(raw.tieBreakOrder),
    qualifyTop: isNonNegInt(raw.qualifyTop)
      ? raw.qualifyTop
      : DEFAULT_STANDINGS_CONFIG.qualifyTop,
  };
}
