import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeachingAssignmentDto {
  @IsNotEmpty() @IsString() classId: string;
  @IsNotEmpty() @IsString() subjectId: string;
  @IsOptional() @IsString() teacherId?: string | null;
}
