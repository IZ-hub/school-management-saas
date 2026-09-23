import { IsOptional, IsString } from 'class-validator';

export class UpdateExamDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}
