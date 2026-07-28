/**
 * Self-running unit checks for Match lifecycle map.
 * Run: npm run test:match
 */
import assert from 'node:assert/strict';
import { MatchStatus } from '@prisma/client';
import {
  getNextMatchStatus,
  MATCH_FORWARD_TRANSITIONS,
} from './match.lifecycle';

assert.equal(getNextMatchStatus(MatchStatus.waiting), MatchStatus.warm_up);
assert.equal(getNextMatchStatus(MatchStatus.warm_up), MatchStatus.live);
assert.equal(getNextMatchStatus(MatchStatus.live), MatchStatus.finished);
assert.equal(getNextMatchStatus(MatchStatus.finished), MatchStatus.verified);
assert.equal(getNextMatchStatus(MatchStatus.verified), null);

assert.equal(
  MATCH_FORWARD_TRANSITIONS[MatchStatus.waiting],
  MatchStatus.warm_up,
);

console.log('match-lifecycle unit checks passed');
