import { UserRole } from '@prisma/client';
import { RoleAssignmentView } from '../types/auth-user.type';

export enum Permission {
  PLATFORM_MANAGE = 'platform:manage',
  TOURNAMENT_MANAGE = 'tournament:manage',
  MATCH_SCORE = 'match:score',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.super_admin]: [
    Permission.PLATFORM_MANAGE,
    Permission.TOURNAMENT_MANAGE,
    Permission.MATCH_SCORE,
  ],
  [UserRole.tournament_admin]: [Permission.TOURNAMENT_MANAGE],
  [UserRole.referee]: [Permission.MATCH_SCORE],
};

export type AuthorizationContext = {
  tournamentId?: string;
};

export function hasPermission(
  assignments: RoleAssignmentView[],
  permission: Permission,
  context: AuthorizationContext = {},
): boolean {
  return assignments.some((assignment) => {
    const rolePermissions = ROLE_PERMISSIONS[assignment.role] ?? [];
    if (!rolePermissions.includes(permission)) {
      return false;
    }

    if (assignment.role === UserRole.super_admin) {
      return true;
    }

    // MVP: global role (tournamentId null) grants permission across tournaments.
    // Future: scoped assignment must match context.tournamentId.
    if (assignment.tournamentId === null) {
      return true;
    }

    if (!context.tournamentId) {
      return false;
    }

    return assignment.tournamentId === context.tournamentId;
  });
}

export function hasAnyRole(
  assignments: RoleAssignmentView[],
  roles: UserRole[],
  context: AuthorizationContext = {},
): boolean {
  return assignments.some((assignment) => {
    if (!roles.includes(assignment.role)) {
      return false;
    }

    if (assignment.role === UserRole.super_admin) {
      return true;
    }

    if (assignment.tournamentId === null) {
      return true;
    }

    if (!context.tournamentId) {
      return false;
    }

    return assignment.tournamentId === context.tournamentId;
  });
}
