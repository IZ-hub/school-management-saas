import { IsOptional, IsString } from 'class-validator';

export class UpdateTimetableDto {
  @IsOptional() @IsString() room?: string;
  @IsOptional() @IsString() day?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}
