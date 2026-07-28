import { LockState, PublishState, TournamentStatus } from '@prisma/client';

/** Publish Schedule allowed in preparation / live ops (not Draft/Finished/Archived). */
export const SCHEDULE_PUBLISH_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.setup,
  TournamentStatus.published,
  TournamentStatus.live,
];

/**
 * Live Ready — conceptual gate for Step 8 (not a DB column).
 * Live Match operations require Schedule Published AND Locked with Official version.
 */
export type ScheduleReadinessSnapshot = {
  publishState: PublishState | string;
  lockState: LockState | string;
  currentOfficialVersionId: string | null;
};

export function isLiveReady(schedule: ScheduleReadinessSnapshot): boolean {
  return (
    schedule.publishState === PublishState.published &&
    schedule.lockState === LockState.locked &&
    schedule.currentOfficialVersionId != null
  );
}
