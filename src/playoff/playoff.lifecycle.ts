import { LockState, TournamentStatus } from '@prisma/client';

export const PLAYOFF_GENERATION_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.live,
];

export function isPlayoffLocked(lockState: LockState): boolean {
  return lockState === LockState.locked;
}
