export type GroupPartitionConfig = {
  groupCount: number;
  teamsPerGroup: number;
};

export function parseGroupPartitionConfig(
  configuration: unknown,
): GroupPartitionConfig {
  if (
    !configuration ||
    typeof configuration !== 'object' ||
    Array.isArray(configuration)
  ) {
    throw new Error('Category configuration is required for Drawing');
  }

  const config = configuration as Record<string, unknown>;
  const groupCount = config.groupCount;
  const teamsPerGroup = config.teamsPerGroup;

  if (
    typeof groupCount !== 'number' ||
    !Number.isInteger(groupCount) ||
    groupCount < 1
  ) {
    throw new Error('configuration.groupCount must be a positive integer');
  }

  if (
    typeof teamsPerGroup !== 'number' ||
    !Number.isInteger(teamsPerGroup) ||
    teamsPerGroup < 1
  ) {
    throw new Error('configuration.teamsPerGroup must be a positive integer');
  }

  return { groupCount, teamsPerGroup };
}

export function assertExactPartition(
  eligibleCount: number,
  partition: GroupPartitionConfig,
): void {
  const expected = partition.groupCount * partition.teamsPerGroup;
  if (eligibleCount !== expected) {
    throw new Error(
      `Eligible team count ${eligibleCount} does not match exact partition ${partition.groupCount}×${partition.teamsPerGroup} (=${expected})`,
    );
  }
}

export function groupLabelForIndex(index: number): string {
  if (index < 0 || index >= 26) {
    throw new Error('MVP supports at most 26 groups (A–Z)');
  }
  return String.fromCharCode(65 + index);
}

export function groupNameForIndex(index: number): string {
  return `Group ${groupLabelForIndex(index)}`;
}
