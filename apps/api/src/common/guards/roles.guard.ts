import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../roles';

/**
 * Must run after JwtAuthGuard. Denies by default: a route with no @Roles
 * metadata on either the handler or the controller is rejected.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const role = context.switchToHttp().getRequest().user?.role;

    if (!allowed || !allowed.includes(role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
