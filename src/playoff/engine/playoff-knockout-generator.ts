import {
  BracketSideKnown,
  GenerateBracketResult,
  KnockoutTeamSeed,
  PlannedBracketMatch,
  PLAYOFF_BRACKET_ENGINE_VERSION,
} from './playoff.types';

const MAX_CUP_TEAMS = 16;

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function seedSide(teamId: string, seed: number): BracketSideKnown {
  return {
    kind: 'seed',
    teamId,
    groupKey: 'CUP',
    rankPosition: seed,
  };
}

function roundName(teamCount: number): PlannedBracketMatch['round'] {
  switch (teamCount) {
    case 2:
      return 'final';
    case 4:
      return 'semi_final';
    case 8:
      return 'quarter_final';
    case 16:
      return 'round_of_16';
    default:
      throw new Error(`Unsupported bracket size ${teamCount}`);
  }
}

function prefixForRound(round: PlannedBracketMatch['round']): string {
  switch (round) {
    case 'final':
      return 'F';
    case 'semi_final':
      return 'SF';
    case 'quarter_final':
      return 'QF';
    case 'round_of_16':
      return 'R16';
  }
}

/**
 * Build seeded knockout/cup bracket from ordered team list.
 * Bracket size = next power of 2; top seeds receive byes when N is not power of 2.
 * Supports 2..16 entrants.
 */
export function generateKnockoutBracket(params: {
  teams: KnockoutTeamSeed[];
}): GenerateBracketResult {
  const teams = [...params.teams].sort((a, b) => a.seed - b.seed);
  const n = teams.length;

  if (n < 2) {
    throw new Error('knockout_only requires at least 2 teams');
  }
  if (n > MAX_CUP_TEAMS) {
    throw new Error(
      `knockout_only supports at most ${MAX_CUP_TEAMS} teams (got ${n})`,
    );
  }

  for (let i = 0; i < n; i += 1) {
    if (teams[i].seed !== i + 1) {
      throw new Error(
        `Seeds must be contiguous 1..${n} (missing or duplicate seed)`,
      );
    }
  }

  const bracketSize = nextPowerOfTwo(n);
  // Pad with null byes at the end → classic pairing gives byes to top seeds
  const slots: Array<KnockoutTeamSeed | null> = [...teams];
  while (slots.length < bracketSize) {
    slots.push(null);
  }

  const matches: PlannedBracketMatch[] = [];
  const byeWinners: GenerateBracketResult['byeWinners'] = [];
  const firstRound = roundName(bracketSize);
  const firstPrefix = prefixForRound(firstRound);
  const firstPositions: string[] = [];

  for (let i = 0; i < bracketSize / 2; i += 1) {
    const a = slots[i];
    const b = slots[bracketSize - 1 - i];
    const pos =
      firstRound === 'final' ? 'F' : `${firstPrefix}${i + 1}`;
    firstPositions.push(pos);

    if (a && b) {
      matches.push({
        bracketPosition: pos,
        round: firstRound,
        sideA: seedSide(a.teamId, a.seed),
        sideB: seedSide(b.teamId, b.seed),
        materialize: true,
      });
    } else if (a && !b) {
      matches.push({
        bracketPosition: pos,
        round: firstRound,
        sideA: seedSide(a.teamId, a.seed),
        sideB: { kind: 'bye' },
        materialize: false,
        byeWinnerTeamId: a.teamId,
      });
      byeWinners.push({ bracketPosition: pos, winnerTeamId: a.teamId });
    } else if (!a && b) {
      matches.push({
        bracketPosition: pos,
        round: firstRound,
        sideA: { kind: 'bye' },
        sideB: seedSide(b.teamId, b.seed),
        materialize: false,
        byeWinnerTeamId: b.teamId,
      });
      byeWinners.push({ bracketPosition: pos, winnerTeamId: b.teamId });
    } else {
      throw new Error(`Empty first-round slot at ${pos}`);
    }
  }

  // Dependent rounds
  let prevPositions = firstPositions;
  let size = bracketSize / 2;
  while (size >= 2) {
    const round = roundName(size);
    const prefix = prefixForRound(round);
    const nextPositions: string[] = [];
    for (let i = 0; i < prevPositions.length / 2; i += 1) {
      const pos = round === 'final' ? 'F' : `${prefix}${i + 1}`;
      nextPositions.push(pos);
      matches.push({
        bracketPosition: pos,
        round,
        sideA: { kind: 'winner_of', bracketPosition: prevPositions[i * 2] },
        sideB: {
          kind: 'winner_of',
          bracketPosition: prevPositions[i * 2 + 1],
        },
        materialize: false,
      });
    }
    prevPositions = nextPositions;
    size /= 2;
  }

  const materializable = matches
    .filter((m) => m.materialize)
    .map((m) => {
      if (m.sideA.kind !== 'seed' || m.sideB.kind !== 'seed') {
        throw new Error(
          `Match ${m.bracketPosition} marked materialize without seeds`,
        );
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
      pairingMode: 'seeded_knockout',
      qualifyTop: n,
      bracketSize,
      matches,
    },
    materializable,
    byeWinners,
  };
}
