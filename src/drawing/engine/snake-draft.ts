/**
 * Snake draft into `groupCount` groups.
 * Order: 1→A, 2→B, …, N→last, then reverse: … →B, →A, repeat.
 */
export function snakeDraftAllocate<T>(
  orderedItems: readonly T[],
  groupCount: number,
): T[][] {
  if (groupCount < 1) {
    throw new Error('groupCount must be >= 1');
  }

  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  let direction = 1;
  let groupIndex = 0;

  for (const item of orderedItems) {
    groups[groupIndex]!.push(item);

    if (direction === 1) {
      if (groupIndex === groupCount - 1) {
        direction = -1;
      } else {
        groupIndex += 1;
      }
    } else if (groupIndex === 0) {
      direction = 1;
    } else {
      groupIndex -= 1;
    }
  }

  return groups;
}

/** Sequential fill: first N into group A, next N into B, … */
export function sequentialAllocate<T>(
  orderedItems: readonly T[],
  groupCount: number,
  teamsPerGroup: number,
): T[][] {
  const groups: T[][] = [];
  for (let g = 0; g < groupCount; g += 1) {
    const start = g * teamsPerGroup;
    groups.push(orderedItems.slice(start, start + teamsPerGroup) as T[]);
  }
  return groups;
}
