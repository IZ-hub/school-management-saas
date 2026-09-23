import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeeDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsString() classId: string;
  @IsNotEmpty() @IsString() term: string;
  @IsNotEmpty() @IsNumber() @Type(() => Number) amount: number;
  @IsNotEmpty() @IsString() dueDate: string;
  @IsOptional() @IsString() status?: string;
}
