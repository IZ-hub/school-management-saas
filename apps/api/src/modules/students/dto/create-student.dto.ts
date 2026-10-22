import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateStudentDto {
  @IsNotEmpty() @IsString() firstName: string;
  @IsNotEmpty() @IsString() lastName: string;
  @IsNotEmpty() @IsString() dateOfBirth: string;
  @IsNotEmpty() @IsString() gender: string;
  @IsNotEmpty() @IsString() admissionNumber: string;
  @IsOptional() @IsString() @Matches(ISO_DATE, { message: 'Admission date must be a date like 2026-09-14.' }) admissionDate?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() parentEmail?: string;
  @IsOptional() @IsString() parentPhone?: string;
  @IsOptional() @IsString() address?: string;
}
