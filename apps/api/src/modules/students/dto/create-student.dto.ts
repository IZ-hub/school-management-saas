import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @IsNotEmpty() @IsString() firstName: string;
  @IsNotEmpty() @IsString() lastName: string;
  @IsNotEmpty() @IsString() dateOfBirth: string;
  @IsNotEmpty() @IsString() gender: string;
  @IsNotEmpty() @IsString() admissionNumber: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() parentEmail?: string;
  @IsOptional() @IsString() parentPhone?: string;
  @IsOptional() @IsString() address?: string;
}
