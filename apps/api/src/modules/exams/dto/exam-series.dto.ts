import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const TERMS = ['FIRST', 'SECOND', 'THIRD'] as const;
export type Term = (typeof TERMS)[number];
export const TERM_LABEL: Record<Term, string> = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' };

export class CreateExamSeriesDto {
  @IsIn(TERMS as unknown as string[]) term: Term;
  /** e.g. "2026/2027" */
  @Matches(/^\d{4}\/\d{4}$/, { message: 'Session must look like 2026/2027' }) session: string;
  /** Defaults to "First Term Examination 2026/2027". */
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsNotEmpty() @IsString() startDate: string;
  @IsNotEmpty() @IsString() endDate: string;
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) classIds: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) defaultMaxScore?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) defaultDurationMinutes?: number;
}

export class UpdateExamSeriesDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}

export class AddPapersDto {
  /** Classes to add to the series. Missing papers are created for these and for the series' existing classes. */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) classIds?: string[];
}

export class PublishResultsDto {
  @IsBoolean() published: boolean;
}
