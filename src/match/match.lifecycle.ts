import { MatchStatus } from '@prisma/client';

/** Official Match Status order (MATCH-03). */
export const MATCH_STATUS_ORDER: MatchStatus[] = [
  MatchStatus.waiting,
  MatchStatus.warm_up,
  MatchStatus.live,
  MatchStatus.finished,
  MatchStatus.verified,
];

export const MATCH_FORWARD_TRANSITIONS: Record<
  MatchStatus,
  MatchStatus | null
> = {
  [MatchStatus.waiting]: MatchStatus.warm_up,
  [MatchStatus.warm_up]: MatchStatus.live,
  [MatchStatus.live]: MatchStatus.finished,
  [MatchStatus.finished]: MatchStatus.verified,
  [MatchStatus.verified]: null,
};

/** Court-occupying statuses — at most one Match per Court (platform invariant). */
export const COURT_OCCUPYING_STATUSES: MatchStatus[] = [
  MatchStatus.warm_up,
  MatchStatus.live,
];

export function getNextMatchStatus(
  current: MatchStatus,
): MatchStatus | null {
  return MATCH_FORWARD_TRANSITIONS[current] ?? null;
}
