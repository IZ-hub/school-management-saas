import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateClassDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() gradeLevel?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) capacity?: number;
}
