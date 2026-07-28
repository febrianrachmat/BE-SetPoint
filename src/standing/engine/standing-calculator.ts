import {
  StandingMatchInput,
  StandingsConfig,
  TeamStandingStats,
} from './standing.types';

function emptyStats(teamId: string): TeamStandingStats {
  return {
    teamId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  };
}

/**
 * Accumulate W-L-P and set/game tallies from verified match results.
 * Does not rank — see ranking + tie-break modules (Step 9B).
 */
export function accumulateStandings(params: {
  teamIds: string[];
  matches: StandingMatchInput[];
  config: Pick<StandingsConfig, 'pointsForWin' | 'pointsForLoss'>;
}): TeamStandingStats[] {
  const byTeam = new Map<string, TeamStandingStats>();
  for (const teamId of params.teamIds) {
    byTeam.set(teamId, emptyStats(teamId));
  }

  for (const match of params.matches) {
    if (!byTeam.has(match.teamAId) || !byTeam.has(match.teamBId)) {
      throw new Error(
        `Match teams must belong to the standing group (${match.teamAId}, ${match.teamBId})`,
      );
    }

    const teamA = byTeam.get(match.teamAId)!;
    const teamB = byTeam.get(match.teamBId)!;

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;

    if (match.winnerSide === 'A') {
      teamA.wins += 1;
      teamB.losses += 1;
      teamA.points += params.config.pointsForWin;
      teamB.points += params.config.pointsForLoss;
    } else {
      teamB.wins += 1;
      teamA.losses += 1;
      teamB.points += params.config.pointsForWin;
      teamA.points += params.config.pointsForLoss;
    }

    teamA.setsWon += match.setsWon.A;
    teamA.setsLost += match.setsWon.B;
    teamB.setsWon += match.setsWon.B;
    teamB.setsLost += match.setsWon.A;

    for (const [gamesA, gamesB] of match.sets) {
      teamA.gamesWon += gamesA;
      teamA.gamesLost += gamesB;
      teamB.gamesWon += gamesB;
      teamB.gamesLost += gamesA;
    }
  }

  return [...byTeam.values()];
}
