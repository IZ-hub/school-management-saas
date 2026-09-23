import { IsOptional, IsString } from 'class-validator';

export class UpdateAttendanceDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() status?: string;
}
