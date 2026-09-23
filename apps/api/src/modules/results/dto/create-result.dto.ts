import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResultDto {
  @IsNotEmpty() @IsString() examId: string;
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsNumber() @Type(() => Number) score: number;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() remarks?: string;
}
