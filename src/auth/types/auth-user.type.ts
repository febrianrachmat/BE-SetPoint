import { UserRole } from '@prisma/client';

export type RoleAssignmentView = {
  role: UserRole;
  tournamentId: string | null;
};

export type AuthUserView = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleAssignmentView[];
};

export type JwtPayload = {
  sub: string;
  email: string;
  roles: RoleAssignmentView[];
};
