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
  /** Gap after a match before the same court/teams are used again. */
  restBufferMinutes?: number;
};

function validateAssignInput(input: AssignScheduleInput): void {
  if (input.courts.length < 1) {
    throw new Error('At least one available Court is required (SCH-02)');
  }
  if (input.matchDurationMinutes < 1) {
    throw new Error('matchDurationMinutes must be >= 1');
  }
  if (
    input.restBufferMinutes != null &&
    (!Number.isFinite(input.restBufferMinutes) || input.restBufferMinutes < 0)
  ) {
    throw new Error('restBufferMinutes must be >= 0');
  }
}

function finalizeAssigned(assigned: AssignedMatch[]): AssignedMatch[] {
  assigned.sort(
    (a, b) =>
      a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime() ||
      a.sequenceOrder - b.sequenceOrder,
  );
  assigned.forEach((match, index) => {
    match.sequenceOrder = index + 1;
  });
  assertNoCourtConflicts(assigned);
  assertNoTeamConflicts(assigned);
  return assigned;
}

/**
 * Schedule group-round waves onto courts without court/team overlap.
 * Matches sharing the same round index across groups may run in parallel.
 */
export function assignCourtsAndTimesRoundWave(
  input: AssignScheduleInput,
): AssignedMatch[] {
  validateAssignInput(input);

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

  return finalizeAssigned(assigned);
}

/**
 * Dedicate each court to one group until that group's matches finish,
 * then pull the next waiting group onto the freed court.
 * Ideal when courts ≈ groups in the category (e.g. 4 groups on 4 courts).
 */
export function assignCourtsAndTimesGroupBlock(
  input: AssignScheduleInput,
): AssignedMatch[] {
  validateAssignInput(input);

  const durationMs = input.matchDurationMinutes * 60 * 1000;
  const bufferMs = (input.restBufferMinutes ?? 0) * 60 * 1000;

  const groupOrder: string[] = [];
  const byGroup = new Map<string, PlannedMatchInput[]>();
  for (const match of input.matches) {
    if (!byGroup.has(match.groupId)) {
      groupOrder.push(match.groupId);
      byGroup.set(match.groupId, []);
    }
    byGroup.get(match.groupId)!.push(match);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.round - b.round);
  }

  type CourtState = {
    courtId: string;
    freeAt: number;
    groupId: string | null;
    matchIndex: number;
  };

  const courts: CourtState[] = input.courts.map((court) => ({
    courtId: court.id,
    freeAt: input.startAt.getTime(),
    groupId: null,
    matchIndex: 0,
  }));

  const waiting = [...groupOrder];
  for (const court of courts) {
    const groupId = waiting.shift();
    if (groupId) {
      court.groupId = groupId;
      court.matchIndex = 0;
    }
  }

  const assigned: AssignedMatch[] = [];
  let sequenceOrder = 1;
  const teamFreeAt = new Map<string, number>();
  const total = input.matches.length;
  let guard = 0;

  while (assigned.length < total) {
    guard += 1;
    if (guard > total * 4 + 20) {
      throw new Error('Schedule group-block stalled while assigning matches');
    }

    let best: CourtState | null = null;
    for (const court of courts) {
      if (!court.groupId) continue;
      const list = byGroup.get(court.groupId);
      if (!list || court.matchIndex >= list.length) continue;
      if (!best || court.freeAt < best.freeAt) {
        best = court;
      }
    }

    if (!best || !best.groupId) {
      const freeCourts = courts.filter((court) => {
        if (!court.groupId) return true;
        const list = byGroup.get(court.groupId);
        return !list || court.matchIndex >= list.length;
      });
      if (waiting.length === 0) {
        throw new Error('Schedule group-block stalled with no waiting groups');
      }
      for (const court of freeCourts) {
        const groupId = waiting.shift();
        if (!groupId) break;
        court.groupId = groupId;
        court.matchIndex = 0;
      }
      continue;
    }

    const list = byGroup.get(best.groupId)!;
    const match = list[best.matchIndex]!;
    const teamReady = Math.max(
      teamFreeAt.get(match.teamAId) ?? 0,
      teamFreeAt.get(match.teamBId) ?? 0,
    );
    const startMs = Math.max(best.freeAt, teamReady);
    const endMs = startMs + durationMs;
    const nextFree = endMs + bufferMs;

    assigned.push({
      ...match,
      sequenceOrder,
      courtId: best.courtId,
      scheduledStartAt: new Date(startMs),
      scheduledEndAt: new Date(endMs),
    });
    sequenceOrder += 1;
    best.matchIndex += 1;
    best.freeAt = nextFree;
    teamFreeAt.set(match.teamAId, nextFree);
    teamFreeAt.set(match.teamBId, nextFree);

    if (best.matchIndex >= list.length) {
      const nextGroup = waiting.shift();
      if (nextGroup) {
        best.groupId = nextGroup;
        best.matchIndex = 0;
      } else {
        best.groupId = null;
      }
    }
  }

  return finalizeAssigned(assigned);
}

/** @deprecated Prefer explicit strategy helpers; defaults to round-wave. */
export function assignCourtsAndTimes(
  input: AssignScheduleInput,
): AssignedMatch[] {
  return assignCourtsAndTimesRoundWave(input);
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
