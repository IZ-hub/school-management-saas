import { ArrayMaxSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SheetScoreDto {
  @IsNotEmpty() @IsString() studentId: string;

  /** Continuous assessment; null clears it. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(100) ca?: number | null;

  /** Exam score; null clears it. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(100) exam?: number | null;
}

export class SaveSheetDto {
  @IsNotEmpty() @IsString() examId: string;

  @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => SheetScoreDto) scores: SheetScoreDto[];
}
