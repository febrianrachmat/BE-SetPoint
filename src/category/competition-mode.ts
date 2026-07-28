export type CompetitionMode = 'group_then_knockout' | 'knockout_only';

export const DEFAULT_COMPETITION_MODE: CompetitionMode = 'group_then_knockout';

const MODES = new Set<CompetitionMode>([
  'group_then_knockout',
  'knockout_only',
]);

/**
 * Resolve Category.configuration.competitionMode (default: group_then_knockout).
 */
export function resolveCompetitionMode(configuration: unknown): CompetitionMode {
  const root =
    configuration &&
    typeof configuration === 'object' &&
    !Array.isArray(configuration)
      ? (configuration as Record<string, unknown>)
      : {};

  const raw = root.competitionMode;
  if (typeof raw === 'string' && MODES.has(raw as CompetitionMode)) {
    return raw as CompetitionMode;
  }

  return DEFAULT_COMPETITION_MODE;
}

/**
 * Normalize + validate configuration for create/update Category.
 * Ensures competitionMode is present; requires group partition fields for group mode.
 */
export function normalizeCategoryConfiguration(
  configuration: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const base = { ...(configuration ?? {}) };
  const mode = resolveCompetitionMode(base);
  base.competitionMode = mode;

  if (mode === 'group_then_knockout') {
    const groupCount = base.groupCount;
    const teamsPerGroup = base.teamsPerGroup;
    if (
      typeof groupCount !== 'number' ||
      !Number.isInteger(groupCount) ||
      groupCount < 1
    ) {
      throw new Error(
        'group_then_knockout requires configuration.groupCount (positive integer)',
      );
    }
    if (
      typeof teamsPerGroup !== 'number' ||
      !Number.isInteger(teamsPerGroup) ||
      teamsPerGroup < 2
    ) {
      throw new Error(
        'group_then_knockout requires configuration.teamsPerGroup (>= 2)',
      );
    }
  }

  if (typeof base.teamSize !== 'number' || !Number.isInteger(base.teamSize) || base.teamSize < 1) {
    base.teamSize = 2;
  }

  return base;
}
