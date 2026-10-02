import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

/** Schedule or adjust one paper. Send date: null to unschedule it. */
export class UpdatePaperDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() date?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() startTime?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) maxScore?: number;
}
