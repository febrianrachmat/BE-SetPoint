import { LockState, PublishState, TournamentStatus } from '@prisma/client';

export const DRAWING_GENERATION_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.setup,
  TournamentStatus.published,
];

/** Publish Drawing requires Tournament at least Setup (not Draft/Finished/Archived). */
export const DRAWING_PUBLISH_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.setup,
  TournamentStatus.published,
  TournamentStatus.live,
];

/**
 * Schedule Ready — conceptual gate for Step 7 (not a DB column).
 *
 * Schedule Generation is allowed only when Drawing is Published AND Locked.
 * Schedule Engine should call this helper instead of re-interpreting state combinations.
 */
export type DrawingReadinessSnapshot = {
  publishState: PublishState | string;
  lockState: LockState | string;
  currentOfficialVersionId: string | null;
};

export function isScheduleReady(drawing: DrawingReadinessSnapshot): boolean {
  return (
    drawing.publishState === PublishState.published &&
    drawing.lockState === LockState.locked &&
    drawing.currentOfficialVersionId != null
  );
}
