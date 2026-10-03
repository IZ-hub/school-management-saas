/** Mirrors the API's role groups so the menu only shows what each person can open. */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']
export const ACADEMIC_ROLES = [...ADMIN_ROLES, 'TEACHER']
export const FINANCE_ROLES = [...ADMIN_ROLES, 'ACCOUNTANT']
export const STAFF_ROLES = [...ADMIN_ROLES, 'TEACHER', 'ACCOUNTANT']

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  SCHOOL_OWNER: 'School owner',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice principal',
  TEACHER: 'Teacher',
  ACCOUNTANT: 'Accountant',
  PARENT: 'Parent',
}
