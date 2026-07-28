import {
  QualificationStatusValue,
  QualifiedStanding,
  RankedStanding,
} from './standing.types';

/**
 * Apply group qualification from final ranks (Step 9C).
 *
 * Walk competition-ranked rows in order. Fill up to `qualifyTop` slots.
 * If a same-rank block would overflow remaining slots, block the whole
 * block (`qualification_blocked_tie`) for Admin resolution (STD-05).
 */
export function applyQualification(params: {
  ranked: RankedStanding[];
  qualifyTop: number;
}): QualifiedStanding[] {
  const qualifyTop = Math.max(0, params.qualifyTop);
  const ranked = [...params.ranked].sort(
    (a, b) =>
      a.rankPosition - b.rankPosition || a.teamId.localeCompare(b.teamId),
  );

  const out: QualifiedStanding[] = [];
  let qualifiedCount = 0;
  let i = 0;

  while (i < ranked.length) {
    let j = i;
    while (
      j + 1 < ranked.length &&
      ranked[j + 1].rankPosition === ranked[i].rankPosition
    ) {
      j += 1;
    }

    const block = ranked.slice(i, j + 1);
    const blockSize = block.length;
    const rank = ranked[i].rankPosition;

    let status: QualificationStatusValue = 'not_qualified';
    let notesExtra: string | null = null;

    if (qualifyTop > 0 && rank <= qualifyTop) {
      if (qualifiedCount >= qualifyTop) {
        status = 'not_qualified';
      } else if (qualifiedCount + blockSize <= qualifyTop) {
        status = 'qualified';
        qualifiedCount += blockSize;
      } else {
        // Ambiguous cutoff — do not invent a winner (STD-05)
        status = 'not_qualified';
        notesExtra = 'qualification_blocked_tie';
      }
    }

    for (const row of block) {
      const notes = mergeNotes(row.tieBreakNotes, notesExtra);
      out.push({
        ...row,
        tieBreakNotes: notes,
        qualificationStatus: status,
      });
    }

    i = j + 1;
  }

  return out;
}

function mergeNotes(
  existing: string | null,
  extra: string | null,
): string | null {
  if (!extra) return existing;
  if (!existing) return extra;
  if (existing.split('|').includes(extra)) return existing;
  return `${existing}|${extra}`;
}

export function listQualifiedTeamIds(rows: QualifiedStanding[]): string[] {
  return rows
    .filter((r) => r.qualificationStatus === 'qualified')
    .sort(
      (a, b) =>
        a.rankPosition - b.rankPosition || a.teamId.localeCompare(b.teamId),
    )
    .map((r) => r.teamId);
}
