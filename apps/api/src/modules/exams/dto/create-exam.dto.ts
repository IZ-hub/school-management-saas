import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateExamDto {
  @IsNotEmpty() @IsString() classId: string;
  @IsNotEmpty() @IsString() subjectId: string;
  @IsNotEmpty() @IsString() date: string;
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() description?: string;
}
