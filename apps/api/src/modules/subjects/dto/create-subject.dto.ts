import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() code: string;
  @IsOptional() @IsString() teacherId?: string;
}
