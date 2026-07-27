import { TournamentStatus } from '@prisma/client';

export const TOURNAMENT_TRANSITIONS: Record<
  TournamentStatus,
  TournamentStatus | null
> = {
  [TournamentStatus.draft]: TournamentStatus.setup,
  [TournamentStatus.setup]: TournamentStatus.published,
  [TournamentStatus.published]: TournamentStatus.live,
  [TournamentStatus.live]: TournamentStatus.finished,
  [TournamentStatus.finished]: TournamentStatus.archived,
  [TournamentStatus.archived]: null,
};

export function getNextTournamentStatus(
  current: TournamentStatus,
): TournamentStatus | null {
  return TOURNAMENT_TRANSITIONS[current];
}
