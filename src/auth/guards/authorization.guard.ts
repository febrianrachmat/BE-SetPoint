import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  AuthorizationContext,
  hasAnyRole,
  hasPermission,
  Permission,
} from '../permissions/permissions';
import { AuthUserView } from '../types/auth-user.type';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUserView;
      params?: { tournamentId?: string };
      body?: { tournamentId?: string };
      query?: { tournamentId?: string };
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authenticated user required');
    }

    const authContext: AuthorizationContext = {
      tournamentId:
        request.params?.tournamentId ??
        request.body?.tournamentId ??
        request.query?.tournamentId,
    };

    const roleAllowed =
      requiredRoles.length === 0 ||
      hasAnyRole(user.roles, requiredRoles, authContext);

    const permissionAllowed =
      requiredPermissions.length === 0 ||
      requiredPermissions.every((permission) =>
        hasPermission(user.roles, permission, authContext),
      );

    if (!roleAllowed || !permissionAllowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
