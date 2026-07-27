import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUserView } from '../types/auth-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserView => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUserView }>();
    return request.user;
  },
);
