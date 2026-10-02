import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class RegisterMarkDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsIn(ATTENDANCE_STATUSES as unknown as string[]) status: AttendanceStatus;
}

export class SaveRegisterDto {
  @IsNotEmpty() @IsString() classId: string;
  /** YYYY-MM-DD */
  @IsNotEmpty() @IsString() date: string;
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RegisterMarkDto)
  marks: RegisterMarkDto[];
}
