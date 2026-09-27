import { IsOptional, IsString } from 'class-validator';

export class QueryTimetableDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() day?: string;
}
