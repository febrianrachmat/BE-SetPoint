import {
  DRAWING_ENGINE_VERSION,
  PlacementMode,
  PRNG_ALGORITHM_MULBERRY32_V1,
} from './drawing-engine.constants';
import {
  assertExactPartition,
  groupLabelForIndex,
  groupNameForIndex,
  GroupPartitionConfig,
  parseGroupPartitionConfig,
} from './group-partition';
import { seededShuffle } from './seeded-prng';
import { sequentialAllocate, snakeDraftAllocate } from './snake-draft';

export type EligibleTeamInput = {
  id: string;
  seedRank: number | null;
};

export type GeneratedGroupMember = {
  teamId: string;
  placementOrder: number;
};

export type GeneratedGroup = {
  name: string;
  label: string;
  members: GeneratedGroupMember[];
};

export type GenerateDrawingInput = {
  configuration: unknown;
  eligibleTeams: EligibleTeamInput[];
  placementMode: PlacementMode;
  drawingSeed: string;
};

export type GenerateDrawingResult = {
  groups: GeneratedGroup[];
  placementMode: PlacementMode;
  drawingSeed: string;
  prngAlgorithm: string | null;
  engineVersion: string;
};

export function generateDrawingPlacements(
  input: GenerateDrawingInput,
): GenerateDrawingResult {
  const partition = parseGroupPartitionConfig(input.configuration);
  assertExactPartition(input.eligibleTeams.length, partition);

  let orderedIds: string[];
  let prngAlgorithm: string | null;

  if (input.placementMode === PlacementMode.random) {
    prngAlgorithm = PRNG_ALGORITHM_MULBERRY32_V1;
    const ids = input.eligibleTeams.map((team) => team.id);
    orderedIds = seededShuffle(ids, input.drawingSeed);
  } else {
    prngAlgorithm = null;
    const missing = input.eligibleTeams.filter((team) => team.seedRank == null);
    if (missing.length > 0) {
      throw new Error(
        `SEEDED placement requires seedRank on all eligible teams (${missing.length} missing)`,
      );
    }
    orderedIds = [...input.eligibleTeams]
      .sort((a, b) => {
        if (a.seedRank !== b.seedRank) {
          return (a.seedRank as number) - (b.seedRank as number);
        }
        return a.id.localeCompare(b.id);
      })
      .map((team) => team.id);
  }

  const allocated =
    input.placementMode === PlacementMode.random
      ? sequentialAllocate(
          orderedIds,
          partition.groupCount,
          partition.teamsPerGroup,
        )
      : snakeDraftAllocate(orderedIds, partition.groupCount);

  assertAllocationInvariants(allocated, orderedIds, partition);

  const groups: GeneratedGroup[] = allocated.map((teamIds, index) => ({
    name: groupNameForIndex(index),
    label: groupLabelForIndex(index),
    members: teamIds.map((teamId, memberIndex) => ({
      teamId,
      placementOrder: memberIndex + 1,
    })),
  }));

  return {
    groups,
    placementMode: input.placementMode,
    drawingSeed: input.drawingSeed,
    prngAlgorithm,
    engineVersion: DRAWING_ENGINE_VERSION,
  };
}

function assertAllocationInvariants(
  allocated: string[][],
  orderedIds: string[],
  partition: GroupPartitionConfig,
): void {
  if (allocated.length !== partition.groupCount) {
    throw new Error('Allocated group count mismatch');
  }

  const seen = new Set<string>();
  for (const group of allocated) {
    if (group.length !== partition.teamsPerGroup) {
      throw new Error('Allocated group size mismatch');
    }
    for (const teamId of group) {
      if (seen.has(teamId)) {
        throw new Error(`Duplicate team in allocation: ${teamId}`);
      }
      seen.add(teamId);
    }
  }

  if (seen.size !== orderedIds.length) {
    throw new Error('Not all eligible teams were allocated');
  }
}
