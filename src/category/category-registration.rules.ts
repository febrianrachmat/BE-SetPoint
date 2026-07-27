import { TournamentStatus } from '@prisma/client';

/** Tournament statuses that allow Category create/update (CAT-02 / CAT-03). */
export const CATEGORY_MUTABLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.draft,
  TournamentStatus.setup,
  TournamentStatus.published,
];

/** Tournament statuses that allow Team/Player registration (TEAM-02). */
export const REGISTRATION_OPEN_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.draft,
  TournamentStatus.setup,
  TournamentStatus.published,
];

export function extractTeamSize(configuration: unknown): number | null {
  if (
    configuration &&
    typeof configuration === 'object' &&
    !Array.isArray(configuration) &&
    'teamSize' in configuration
  ) {
    const value = (configuration as { teamSize?: unknown }).teamSize;
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return null;
}

export function normalizePlayerName(displayName: string): string {
  return displayName.trim().toLowerCase();
}
