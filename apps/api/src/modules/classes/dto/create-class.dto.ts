import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClassDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() gradeLevel: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) capacity?: number;
}
