import { accumulateStandings } from './standing-calculator';
import {
  StandingMatchInput,
  TeamStandingStats,
  TieBreakCriterion,
} from './standing.types';

export type TieBreakSortKey = number[];

export type OrderedTeam = {
  stats: TeamStandingStats;
  /** Non-null ⇒ shares unresolved/pending tie with the same group id */
  tieGroupId: string | null;
  tieBreakNotes: string | null;
};

function setDiff(s: TeamStandingStats): number {
  return s.setsWon - s.setsLost;
}

function gameDiff(s: TeamStandingStats): number {
  return s.gamesWon - s.gamesLost;
}

function keysEqual(a: TieBreakSortKey, b: TieBreakSortKey): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function compareKeysDesc(a: TieBreakSortKey, b: TieBreakSortKey): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv !== av) return bv - av;
  }
  return 0;
}

/**
 * Mini-table among `tiedTeamIds` using only matches where both sides are in the set.
 */
export function buildHeadToHeadMiniStats(params: {
  tiedTeamIds: string[];
  matches: StandingMatchInput[];
}): Map<string, TeamStandingStats> {
  const idSet = new Set(params.tiedTeamIds);
  const miniMatches = params.matches.filter(
    (m) => idSet.has(m.teamAId) && idSet.has(m.teamBId),
  );

  const rows = accumulateStandings({
    teamIds: params.tiedTeamIds,
    matches: miniMatches,
    config: { pointsForWin: 1, pointsForLoss: 0 },
  });

  return new Map(rows.map((r) => [r.teamId, r]));
}

function criterionKey(
  criterion: TieBreakCriterion,
  stats: TeamStandingStats,
  tiedGroup: TeamStandingStats[],
  matches: StandingMatchInput[],
  h2hCache: Map<string, TeamStandingStats> | null,
): TieBreakSortKey {
  switch (criterion) {
    case 'points':
      return [stats.points];
    case 'wins':
      return [stats.wins];
    case 'set_difference':
      return [setDiff(stats)];
    case 'sets_won':
      return [stats.setsWon];
    case 'game_difference':
      return [gameDiff(stats)];
    case 'head_to_head': {
      const mini =
        h2hCache?.get(stats.teamId) ??
        buildHeadToHeadMiniStats({
          tiedTeamIds: tiedGroup.map((t) => t.teamId),
          matches,
        }).get(stats.teamId);
      if (!mini) {
        return [0, 0, 0, 0];
      }
      // Mini-table compound key (still one "criterion" step)
      return [mini.points, mini.wins, setDiff(mini), gameDiff(mini)];
    }
    case 'random_draw':
      // Should not be keyed — handled as terminal pending state
      return [0];
  }
}

let tieGroupSeq = 0;
function nextTieGroupId(): string {
  tieGroupSeq += 1;
  return `tie-${tieGroupSeq}`;
}

/**
 * Order teams by configurable tie-break policy (recursive partition).
 */
export function orderTeamsByTieBreak(params: {
  stats: TeamStandingStats[];
  matches: StandingMatchInput[];
  tieBreakOrder: TieBreakCriterion[];
}): OrderedTeam[] {
  tieGroupSeq = 0;
  return sortGroup(
    params.stats,
    params.matches,
    params.tieBreakOrder,
    0,
  );
}

function sortGroup(
  group: TeamStandingStats[],
  matches: StandingMatchInput[],
  order: TieBreakCriterion[],
  criterionIndex: number,
): OrderedTeam[] {
  if (group.length <= 1) {
    return group.map((stats) => ({
      stats,
      tieGroupId: null,
      tieBreakNotes: null,
    }));
  }

  if (criterionIndex >= order.length) {
    const id = nextTieGroupId();
    return group.map((stats) => ({
      stats,
      tieGroupId: id,
      tieBreakNotes: 'unresolved_tie',
    }));
  }

  const criterion = order[criterionIndex];

  if (criterion === 'random_draw') {
    const id = nextTieGroupId();
    return group.map((stats) => ({
      stats,
      tieGroupId: id,
      tieBreakNotes: 'random_draw_pending',
    }));
  }

  const h2hCache =
    criterion === 'head_to_head'
      ? buildHeadToHeadMiniStats({
          tiedTeamIds: group.map((t) => t.teamId),
          matches,
        })
      : null;

  const keyed = group.map((stats) => ({
    stats,
    key: criterionKey(criterion, stats, group, matches, h2hCache),
  }));

  keyed.sort((a, b) => {
    const byKey = compareKeysDesc(a.key, b.key);
    if (byKey !== 0) return byKey;
    return a.stats.teamId.localeCompare(b.stats.teamId);
  });

  const ordered: OrderedTeam[] = [];
  let i = 0;
  while (i < keyed.length) {
    let j = i + 1;
    while (j < keyed.length && keysEqual(keyed[i].key, keyed[j].key)) {
      j += 1;
    }
    const bucket = keyed.slice(i, j).map((k) => k.stats);
    if (bucket.length === 1) {
      ordered.push({
        stats: bucket[0],
        tieGroupId: null,
        tieBreakNotes: null,
      });
    } else {
      ordered.push(...sortGroup(bucket, matches, order, criterionIndex + 1));
    }
    i = j;
  }

  return ordered;
}
