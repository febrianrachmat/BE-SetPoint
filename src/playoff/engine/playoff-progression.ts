import {
  BracketStructure,
  BracketSide,
  PLAYOFF_BRACKET_ENGINE_VERSION,
} from './playoff.types';

export type VerifiedBracketResult = {
  bracketPosition: string;
  winnerTeamId: string;
};

export type AdvancementPlan = {
  /** Matches that can now be persisted (both sides known, not yet materialized) */
  create: Array<{
    bracketPosition: string;
    teamAId: string;
    teamBId: string;
  }>;
  /** Set when Final (or sole Final) has a verified winner */
  championTeamId: string | null;
};

function resolveSide(
  side: BracketSide,
  winners: Map<string, string>,
): string | null {
  if (side.kind === 'seed') {
    return side.teamId;
  }
  if (side.kind === 'bye') {
    return null;
  }
  return winners.get(side.bracketPosition) ?? null;
}

/**
 * Given bracket structure + verified winners, decide which dependent matches
 * to materialize and whether a Champion can be declared (Step 10C).
 */
export function planPlayoffAdvancement(params: {
  structure: BracketStructure;
  verified: VerifiedBracketResult[];
  /** bracketPosition values that already have a Match row */
  materializedPositions: string[];
}): AdvancementPlan {
  if (params.structure.engineVersion !== PLAYOFF_BRACKET_ENGINE_VERSION) {
    throw new Error(
      `Unsupported bracket engine version: ${params.structure.engineVersion}`,
    );
  }

  const winners = new Map(
    params.verified.map((v) => [v.bracketPosition, v.winnerTeamId]),
  );
  // Bye slots from structure are automatic winners
  for (const planned of params.structure.matches) {
    if (planned.byeWinnerTeamId && !winners.has(planned.bracketPosition)) {
      winners.set(planned.bracketPosition, planned.byeWinnerTeamId);
    }
  }

  const materialized = new Set(params.materializedPositions);
  const create: AdvancementPlan['create'] = [];

  for (const planned of params.structure.matches) {
    if (planned.materialize || planned.byeWinnerTeamId) {
      continue;
    }
    if (materialized.has(planned.bracketPosition)) {
      continue;
    }

    const teamAId = resolveSide(planned.sideA, winners);
    const teamBId = resolveSide(planned.sideB, winners);
    if (teamAId && teamBId) {
      if (teamAId === teamBId) {
        throw new Error(
          `Advancement produced same team on both sides of ${planned.bracketPosition}`,
        );
      }
      create.push({
        bracketPosition: planned.bracketPosition,
        teamAId,
        teamBId,
      });
    }
  }

  let championTeamId: string | null = null;
  const final = params.structure.matches.find((m) => m.round === 'final');
  if (final) {
    championTeamId = winners.get(final.bracketPosition) ?? null;
  }

  return { create, championTeamId };
}
