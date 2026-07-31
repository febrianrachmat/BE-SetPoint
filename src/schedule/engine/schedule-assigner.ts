export type PlannedMatchInput = {
  groupId: string;
  teamAId: string;
  teamBId: string;
  round: number;
};

export type CourtInput = {
  id: string;
};

export type AssignedMatch = PlannedMatchInput & {
  sequenceOrder: number;
  courtId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
};

export type AssignScheduleInput = {
  matches: PlannedMatchInput[];
  courts: CourtInput[];
  startAt: Date;
  matchDurationMinutes: number;
};

/**
 * Schedule group-round waves onto courts without court/team overlap.
 * Matches sharing the same round index across groups may run in parallel.
 */
export function assignCourtsAndTimes(
  input: AssignScheduleInput,
): AssignedMatch[] {
  if (input.courts.length < 1) {
    throw new Error('At least one available Court is required (SCH-02)');
  }
  if (input.matchDurationMinutes < 1) {
    throw new Error('matchDurationMinutes must be >= 1');
  }

  const durationMs = input.matchDurationMinutes * 60 * 1000;
  const maxRound = input.matches.reduce(
    (max, match) => Math.max(max, match.round),
    0,
  );

  const assigned: AssignedMatch[] = [];
  let sequenceOrder = 1;
  let cursor = input.startAt.getTime();

  for (let round = 1; round <= maxRound; round += 1) {
    const wave = input.matches.filter((match) => match.round === round);
    let courtIndex = 0;
    let slotStart = cursor;

    for (const match of wave) {
      if (courtIndex >= input.courts.length) {
        courtIndex = 0;
        slotStart += durationMs;
      }

      const court = input.courts[courtIndex]!;
      const start = new Date(slotStart);
      const end = new Date(slotStart + durationMs);

      assigned.push({
        ...match,
        sequenceOrder,
        courtId: court.id,
        scheduledStartAt: start,
        scheduledEndAt: end,
      });

      sequenceOrder += 1;
      courtIndex += 1;
    }

    // next round starts after this wave's last slot ends
    const waveEnd =
      wave.length === 0
        ? cursor
        : slotStart +
          durationMs *
            Math.ceil(wave.length / input.courts.length);
    cursor = Math.max(cursor + durationMs, waveEnd);
  }

  assertNoCourtConflicts(assigned);
  assertNoTeamConflicts(assigned);

  return assigned;
}

export type ScheduleConflictSlot = {
  courtId: string | null;
  teamAId: string;
  teamBId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function assertNoCourtConflicts(
  assigned: Array<Pick<ScheduleConflictSlot, 'courtId' | 'scheduledStartAt' | 'scheduledEndAt'>>,
): void {
  for (let i = 0; i < assigned.length; i += 1) {
    for (let j = i + 1; j < assigned.length; j += 1) {
      const a = assigned[i]!;
      const b = assigned[j]!;
      if (
        a.courtId &&
        a.courtId === b.courtId &&
        overlaps(
          a.scheduledStartAt,
          a.scheduledEndAt,
          b.scheduledStartAt,
          b.scheduledEndAt,
        )
      ) {
        throw new Error(`Court conflict detected on court ${a.courtId} (SCH-05)`);
      }
    }
  }
}

export function assertNoTeamConflicts(assigned: ScheduleConflictSlot[]): void {
  for (let i = 0; i < assigned.length; i += 1) {
    for (let j = i + 1; j < assigned.length; j += 1) {
      const a = assigned[i]!;
      const b = assigned[j]!;
      const shared =
        a.teamAId === b.teamAId ||
        a.teamAId === b.teamBId ||
        a.teamBId === b.teamAId ||
        a.teamBId === b.teamBId;
      if (
        shared &&
        overlaps(
          a.scheduledStartAt,
          a.scheduledEndAt,
          b.scheduledStartAt,
          b.scheduledEndAt,
        )
      ) {
        throw new Error('Team conflict detected in schedule (SCH-06)');
      }
    }
  }
}

/** Re-validate court/team overlaps after a manual reschedule (SCH-05 / SCH-06). */
export function assertNoScheduleConflicts(slots: ScheduleConflictSlot[]): void {
  assertNoCourtConflicts(slots);
  assertNoTeamConflicts(slots);
}
