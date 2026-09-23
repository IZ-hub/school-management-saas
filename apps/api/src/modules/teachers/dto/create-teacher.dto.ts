import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTeacherDto {
  @IsNotEmpty() @IsString() firstName: string;
  @IsNotEmpty() @IsString() lastName: string;
  @IsNotEmpty() @IsString() dateOfBirth: string;
  @IsNotEmpty() @IsString() gender: string;
  @IsNotEmpty() @IsString() employeeNumber: string;
  @IsNotEmpty() @IsString() email: string;
  @IsNotEmpty() @IsString() phone: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() qualification?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() joiningDate?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
}
