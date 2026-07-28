import { accumulateStandings } from './standing-calculator';
import { orderTeamsByTieBreak } from './standing-tie-break';
import {
  RankedStanding,
  StandingMatchInput,
  StandingsConfig,
  TeamStandingStats,
} from './standing.types';

/**
 * Assign competition ranks (1,1,3) from an already ordered list.
 * Shared `tieGroupId` ⇒ shared rank + notes preserved.
 */
export function assignCompetitionRanks(
  ordered: ReturnType<typeof orderTeamsByTieBreak>,
): RankedStanding[] {
  const ranked: RankedStanding[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i];
    const prev = ranked[i - 1];
    const sharesTie =
      i > 0 &&
      current.tieGroupId != null &&
      ordered[i - 1].tieGroupId === current.tieGroupId;

    const rankPosition = sharesTie && prev ? prev.rankPosition : i + 1;

    ranked.push({
      ...current.stats,
      rankPosition,
      tieBreakNotes: current.tieBreakNotes,
    });
  }

  return ranked;
}

export function rankStandings(params: {
  stats: TeamStandingStats[];
  matches: StandingMatchInput[];
  config: StandingsConfig;
}): RankedStanding[] {
  const ordered = orderTeamsByTieBreak({
    stats: params.stats,
    matches: params.matches,
    tieBreakOrder: params.config.tieBreakOrder,
  });
  return assignCompetitionRanks(ordered);
}

export function calculateGroupStandings(params: {
  teamIds: string[];
  matches: StandingMatchInput[];
  config: StandingsConfig;
}): RankedStanding[] {
  const stats = accumulateStandings({
    teamIds: params.teamIds,
    matches: params.matches,
    config: params.config,
  });
  return rankStandings({
    stats,
    matches: params.matches,
    config: params.config,
  });
}
