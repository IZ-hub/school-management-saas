import { IsOptional, IsString } from 'class-validator';

export class QueryTeachingAssignmentDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() teacherId?: string;
}
