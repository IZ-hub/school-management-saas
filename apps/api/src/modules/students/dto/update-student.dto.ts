import { IsOptional, IsString, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateStudentDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() admissionNumber?: string;
  @IsOptional() @IsString() @Matches(ISO_DATE, { message: 'Admission date must be a date like 2026-09-14.' }) admissionDate?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() parentEmail?: string;
  @IsOptional() @IsString() parentPhone?: string;
  @IsOptional() @IsString() address?: string;
}
