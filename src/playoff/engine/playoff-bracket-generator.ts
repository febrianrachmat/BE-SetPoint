import {
  BracketSideKnown,
  GenerateBracketResult,
  PlannedBracketMatch,
  PLAYOFF_BRACKET_ENGINE_VERSION,
  QualifiedSeed,
} from './playoff.types';

function seedSide(seed: QualifiedSeed): BracketSideKnown {
  return {
    kind: 'seed',
    teamId: seed.teamId,
    groupKey: seed.groupKey,
    rankPosition: seed.rankPosition,
  };
}

function requireSeed(
  byGroupRank: Map<string, QualifiedSeed>,
  groupKey: string,
  rank: number,
): QualifiedSeed {
  const key = `${groupKey}:${rank}`;
  const seed = byGroupRank.get(key);
  if (!seed) {
    throw new Error(`Missing qualified seed ${groupKey}${rank}`);
  }
  return seed;
}

/**
 * Build single-elim plan from qualified seeds (Step 10A MVP).
 * Pairing: cross_group_standard — A1vsB2 / B1vsA2 when two groups × top 2.
 */
export function generatePlayoffBracket(params: {
  seeds: QualifiedSeed[];
  qualifyTop: number;
}): GenerateBracketResult {
  if (params.qualifyTop < 1) {
    throw new Error('qualifyTop must be >= 1');
  }
  if (params.seeds.length < 2) {
    throw new Error('At least 2 qualified teams are required for Playoff');
  }

  for (const seed of params.seeds) {
    if (!seed.rankPosition || seed.rankPosition < 1) {
      throw new Error(`Invalid rankPosition for team ${seed.teamId}`);
    }
  }

  const groupKeys = [
    ...new Set(params.seeds.map((s) => s.groupKey)),
  ].sort((a, b) => a.localeCompare(b));

  const byGroupRank = new Map<string, QualifiedSeed>();
  for (const seed of params.seeds) {
    const key = `${seed.groupKey}:${seed.rankPosition}`;
    if (byGroupRank.has(key)) {
      throw new Error(`Duplicate seed ${key}`);
    }
    byGroupRank.set(key, seed);
  }

  let matches: PlannedBracketMatch[] = [];

  if (groupKeys.length === 1 && params.qualifyTop >= 2) {
    const g = groupKeys[0];
    const a1 = requireSeed(byGroupRank, g, 1);
    const a2 = requireSeed(byGroupRank, g, 2);
    matches = [
      {
        bracketPosition: 'F',
        round: 'final',
        sideA: seedSide(a1),
        sideB: seedSide(a2),
        materialize: true,
      },
    ];
  } else if (groupKeys.length === 2 && params.qualifyTop >= 2) {
    const [g0, g1] = groupKeys;
    const a1 = requireSeed(byGroupRank, g0, 1);
    const a2 = requireSeed(byGroupRank, g0, 2);
    const b1 = requireSeed(byGroupRank, g1, 1);
    const b2 = requireSeed(byGroupRank, g1, 2);

    matches = [
      {
        bracketPosition: 'SF1',
        round: 'semi_final',
        sideA: seedSide(a1),
        sideB: seedSide(b2),
        materialize: true,
      },
      {
        bracketPosition: 'SF2',
        round: 'semi_final',
        sideA: seedSide(b1),
        sideB: seedSide(a2),
        materialize: true,
      },
      {
        bracketPosition: 'F',
        round: 'final',
        sideA: { kind: 'winner_of', bracketPosition: 'SF1' },
        sideB: { kind: 'winner_of', bracketPosition: 'SF2' },
        materialize: false,
      },
    ];
  } else {
    throw new Error(
      `Unsupported playoff shape: ${groupKeys.length} groups × qualifyTop ${params.qualifyTop} (MVP supports 1×2 Final or 2×2 SF+Final)`,
    );
  }

  const materializable = matches
    .filter((m) => m.materialize)
    .map((m) => {
      if (m.sideA.kind !== 'seed' || m.sideB.kind !== 'seed') {
        throw new Error(`Match ${m.bracketPosition} marked materialize without seeds`);
      }
      return {
        bracketPosition: m.bracketPosition,
        teamAId: m.sideA.teamId,
        teamBId: m.sideB.teamId,
      };
    });

  return {
    structure: {
      engineVersion: PLAYOFF_BRACKET_ENGINE_VERSION,
      pairingMode: 'cross_group_standard',
      qualifyTop: params.qualifyTop,
      matches,
    },
    materializable,
    byeWinners: [],
  };
}
