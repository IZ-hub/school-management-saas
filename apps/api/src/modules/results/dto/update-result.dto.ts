import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateResultDto {
  @IsOptional() @IsString() examId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) score?: number;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() remarks?: string;
}
