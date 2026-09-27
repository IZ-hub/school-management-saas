import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTimetableDto {
  @IsNotEmpty() @IsString() classId: string;
  @IsNotEmpty() @IsString() subjectId: string;
  @IsNotEmpty() @IsString() teacherId: string;
  @IsNotEmpty() @IsString() room: string;
  @IsNotEmpty() @IsString() day: string;
  @IsNotEmpty() @IsString() startTime: string;
  @IsNotEmpty() @IsString() endTime: string;
}
