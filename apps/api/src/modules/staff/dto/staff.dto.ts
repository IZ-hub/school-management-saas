import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Roles a school can give its staff. SCHOOL_OWNER is never granted; there is one owner per school. */
export const STAFF_ROLE_OPTIONS = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT'] as const;
export type StaffRole = (typeof STAFF_ROLE_OPTIONS)[number];

export class InviteStaffDto {
  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(120) email: string;
  @IsNotEmpty() @IsString() @MaxLength(60) firstName: string;
  @IsNotEmpty() @IsString() @MaxLength(60) lastName: string;
  @IsIn(STAFF_ROLE_OPTIONS) role: StaffRole;
  /** Links the account to a record on the Teachers page. */
  @IsOptional() @IsString() teacherId?: string;
}

export class ChangeRoleDto {
  @IsIn(STAFF_ROLE_OPTIONS) role: StaffRole;
}
