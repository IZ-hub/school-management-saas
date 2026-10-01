import { IsOptional, IsString } from 'class-validator';

export class UpdateTeachingAssignmentDto {
  /** A teacher's ID, or null to leave the subject without a teacher for now. */
  @IsOptional() @IsString() teacherId?: string | null;
}
