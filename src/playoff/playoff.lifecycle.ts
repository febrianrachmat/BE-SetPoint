import { LockState, PublishState, TournamentStatus } from '@prisma/client';

export const PLAYOFF_GENERATION_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.live,
];

export const PLAYOFF_PUBLISH_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.live,
];

export function isPlayoffLocked(lockState: LockState): boolean {
  return lockState === LockState.locked;
}

/**
 * Playoff Ready — conceptual gate for Step 10C match ops.
 * Official bracket Published ∧ Locked.
 */
export type PlayoffReadinessSnapshot = {
  publishState: PublishState | string;
  lockState: LockState | string;
  currentOfficialBracketId: string | null;
};

export function isPlayoffReady(playoff: PlayoffReadinessSnapshot): boolean {
  return (
    playoff.publishState === PublishState.published &&
    playoff.lockState === LockState.locked &&
    playoff.currentOfficialBracketId != null
  );
}
