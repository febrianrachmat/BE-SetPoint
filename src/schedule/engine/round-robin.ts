export type RoundRobinPair = {
  teamAId: string;
  teamBId: string;
  round: number;
};

/**
 * Circle method round-robin. Returns pairs with 1-based round numbers.
 * Odd team counts get a bye (no match involving the bye placeholder).
 */
export function generateRoundRobinPairs(
  teamIds: readonly string[],
): RoundRobinPair[] {
  if (teamIds.length < 2) {
    return [];
  }

  const teams = [...teamIds];
  const bye = '__bye__';
  if (teams.length % 2 === 1) {
    teams.push(bye);
  }

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const pairs: RoundRobinPair[] = [];

  // Work on a rotatable array (fix team[0], rotate the rest)
  const rotation = teams.slice(1);

  for (let round = 0; round < rounds; round += 1) {
    const circle = [teams[0]!, ...rotation];
    for (let i = 0; i < half; i += 1) {
      const a = circle[i]!;
      const b = circle[n - 1 - i]!;
      if (a !== bye && b !== bye) {
        pairs.push({
          teamAId: a,
          teamBId: b,
          round: round + 1,
        });
      }
    }
    // rotate right: last -> front of rotation
    const last = rotation.pop();
    if (last !== undefined) {
      rotation.unshift(last);
    }
  }

  return pairs;
}
