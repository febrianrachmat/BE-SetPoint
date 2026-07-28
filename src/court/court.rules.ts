import { CourtStatus, MatchStatus, TournamentStatus } from '@prisma/client';

/**
 * Court create/update/delete stays open while the event is still being run.
 * A finished or archived tournament is history and must not change.
 */
export const COURT_MUTABLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.draft,
  TournamentStatus.setup,
  TournamentStatus.published,
  TournamentStatus.live,
];

/** Statuses that take a Court out of the pool available to Schedule generation. */
export const COURT_DISABLED_STATUSES: CourtStatus[] = [
  CourtStatus.unavailable,
  CourtStatus.maintenance,
];

/** A Court is occupied while a Match is warming up or playing on it. */
export const COURT_OCCUPYING_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.warm_up,
  MatchStatus.live,
];

export function normalizeCourtLabel(label: string): string {
  return label.trim().toLowerCase();
}
