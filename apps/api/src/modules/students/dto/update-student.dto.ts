import { IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() admissionNumber?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() parentEmail?: string;
  @IsOptional() @IsString() parentPhone?: string;
  @IsOptional() @IsString() address?: string;
}
