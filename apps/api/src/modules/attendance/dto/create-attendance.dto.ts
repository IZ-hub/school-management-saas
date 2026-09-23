import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsString() classId: string;
  @IsNotEmpty() @IsString() subjectId: string;
  @IsNotEmpty() @IsString() date: string;
  @IsNotEmpty() @IsString() status: string;
}
