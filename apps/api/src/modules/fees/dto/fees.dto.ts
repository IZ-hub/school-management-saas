import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TERMS, Term } from '../../../common/school-date';

const SESSION = /^\d{4}\/\d{4}$/;

export class FeeItemDto {
  @IsNotEmpty() @IsString() @MaxLength(60) name: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) amount: number;
}

/** Sets the fees for one or more classes for a term: a list of items such as Tuition and PTA levy. */
export class SaveScheduleDto {
  @IsIn(TERMS) term: Term;
  @Matches(SESSION, { message: 'Session must look like 2026/2027' }) session: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true }) classIds: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => FeeItemDto) items: FeeItemDto[];
  @IsOptional() @IsString() dueDate?: string;
}

/** A per-student reduction for a term, e.g. a sibling discount or scholarship. 0 removes it. */
export class SaveDiscountDto {
  @IsIn(TERMS) term: Term;
  @Matches(SESSION, { message: 'Session must look like 2026/2027' }) session: string;
  @IsNotEmpty() @IsString() studentId: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) amount: number;
  @IsOptional() @IsString() @MaxLength(100) reason?: string;
}
