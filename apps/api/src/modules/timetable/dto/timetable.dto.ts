import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Day = (typeof DAYS)[number];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PeriodDto {
  @IsNotEmpty() @IsString() @MaxLength(20) id: string;
  @IsNotEmpty() @IsString() @MaxLength(30) label: string;
  @Matches(TIME, { message: 'Use times like 08:00' }) start: string;
  @Matches(TIME, { message: 'Use times like 08:40' }) end: string;
  @IsIn(['LESSON', 'BREAK']) kind: 'LESSON' | 'BREAK';
}

export class TimetableSetupDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsIn(DAYS, { each: true }) days: Day[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(16) @ValidateNested({ each: true }) @Type(() => PeriodDto) periods: PeriodDto[];
}

export class SetSlotDto {
  @IsIn(DAYS) day: Day;
  @IsNotEmpty() @IsString() periodId: string;
  /** A subject the class takes (from Class subjects), or null to clear the slot. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() subjectId: string | null;
}
