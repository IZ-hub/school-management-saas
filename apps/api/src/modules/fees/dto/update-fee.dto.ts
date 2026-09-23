import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFeeDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsNumber() @Type(() => Number) amount?: number;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() status?: string;
}
