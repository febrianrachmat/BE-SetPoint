import { DEFAULT_SCORING_TEMPLATE_ID, getScoringTemplate } from './scoring.templates';
import {
  DecidingSetMode,
  DeuceMode,
  MatchFormat,
  ScoringConfig,
  TieBreakConfig,
} from './scoring.types';

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseTieBreak(
  value: unknown,
  label: string,
): TieBreakConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const raw = value as Record<string, unknown>;
  if (
    !isPositiveInt(raw.pointsTo) ||
    !isPositiveInt(raw.mustWinBy) ||
    typeof raw.atGames !== 'number' ||
    !Number.isInteger(raw.atGames) ||
    raw.atGames < 0
  ) {
    throw new Error(`${label} requires atGames (>=0), pointsTo (>0), mustWinBy (>0)`);
  }
  return {
    atGames: raw.atGames,
    pointsTo: raw.pointsTo,
    mustWinBy: raw.mustWinBy,
  };
}

export function validateScoringConfig(input: ScoringConfig): ScoringConfig {
  const formats: MatchFormat[] = ['best_of_1', 'best_of_3', 'best_of_5'];
  const deuces: DeuceMode[] = ['golden_point', 'advantage'];
  const deciding: DecidingSetMode[] = ['full_set', 'match_tiebreak'];

  if (!formats.includes(input.matchFormat)) {
    throw new Error('Invalid matchFormat');
  }
  if (!deuces.includes(input.deuceMode)) {
    throw new Error('Invalid deuceMode');
  }
  if (!deciding.includes(input.decidingSet)) {
    throw new Error('Invalid decidingSet');
  }
  if (!isPositiveInt(input.gamesTo) || !isPositiveInt(input.mustWinBy)) {
    throw new Error('gamesTo and mustWinBy must be positive integers');
  }
  if (input.tieBreak.atGames < 0 || input.matchTieBreak.pointsTo < 1) {
    throw new Error('Invalid tieBreak configuration');
  }
  // Classic TB at 6–6 uses atGames === gamesTo; fast-to-6 TB at 5–5 uses atGames < gamesTo.
  if (input.tieBreak.atGames > input.gamesTo) {
    throw new Error('tieBreak.atGames must be less than or equal to gamesTo');
  }
  return input;
}

/**
 * Resolve Category.configuration.scoring into a validated ScoringConfig.
 * Supports templateId + optional field overrides.
 */
export function resolveScoringConfig(configuration: unknown): ScoringConfig {
  const root =
    configuration && typeof configuration === 'object' && !Array.isArray(configuration)
      ? (configuration as Record<string, unknown>)
      : {};

  const scoringRaw = root.scoring;

  // Legacy seed used scoring: 'best_of_3' string
  if (typeof scoringRaw === 'string') {
    const legacy =
      scoringRaw === 'best_of_3'
        ? getScoringTemplate('best_of_3_gp_full')
        : getScoringTemplate(DEFAULT_SCORING_TEMPLATE_ID);
    if (!legacy) {
      throw new Error('Unable to resolve legacy scoring string');
    }
    return validateScoringConfig(legacy);
  }

  const scoring =
    scoringRaw && typeof scoringRaw === 'object' && !Array.isArray(scoringRaw)
      ? (scoringRaw as Record<string, unknown>)
      : {};

  const templateId =
    typeof scoring.templateId === 'string' && scoring.templateId.length > 0
      ? scoring.templateId
      : DEFAULT_SCORING_TEMPLATE_ID;

  const base =
    templateId === 'custom'
      ? getScoringTemplate(DEFAULT_SCORING_TEMPLATE_ID)!
      : getScoringTemplate(templateId) ??
        getScoringTemplate(DEFAULT_SCORING_TEMPLATE_ID)!;

  const merged: ScoringConfig = {
    ...base,
    templateId,
    ...(typeof scoring.matchFormat === 'string'
      ? { matchFormat: scoring.matchFormat as MatchFormat }
      : {}),
    ...(typeof scoring.gamesTo === 'number' ? { gamesTo: scoring.gamesTo } : {}),
    ...(typeof scoring.mustWinBy === 'number'
      ? { mustWinBy: scoring.mustWinBy }
      : {}),
    ...(typeof scoring.deuceMode === 'string'
      ? { deuceMode: scoring.deuceMode as DeuceMode }
      : {}),
    ...(typeof scoring.decidingSet === 'string'
      ? { decidingSet: scoring.decidingSet as DecidingSetMode }
      : {}),
    ...(scoring.tieBreak
      ? { tieBreak: parseTieBreak(scoring.tieBreak, 'tieBreak') }
      : {}),
    ...(scoring.matchTieBreak
      ? {
          matchTieBreak: parseTieBreak(scoring.matchTieBreak, 'matchTieBreak'),
        }
      : {}),
  };

  return validateScoringConfig(merged);
}
