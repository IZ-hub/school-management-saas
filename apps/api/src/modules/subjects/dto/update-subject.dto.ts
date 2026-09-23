import { IsOptional, IsString } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() teacherId?: string;
}
