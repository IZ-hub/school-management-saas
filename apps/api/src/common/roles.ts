import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restricts a controller or route to the listed roles. A route-level list replaces the controller-level one. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL'];
export const ACADEMIC_ROLES = [...ADMIN_ROLES, 'TEACHER'];
export const FINANCE_ROLES = [...ADMIN_ROLES, 'ACCOUNTANT'];
export const STAFF_ROLES = [...ADMIN_ROLES, 'TEACHER', 'ACCOUNTANT'];
