import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested, IsArray, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { TERMS, Term } from '../../../common/school-date';

export class UpdateSchoolDto {
  @IsOptional() @IsNotEmpty() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Enter a valid school email.' }) @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) motto?: string;
  @IsOptional() @IsString() @MaxLength(80) principalName?: string;
  /** A small image as a data URL (resized in the browser), or null to remove it. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(95_000, { message: 'The logo is too large. Use a smaller image.' })
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'The logo must be a PNG, JPEG or WebP image.' })
  logo?: string | null;
}

export class TermDatesDto {
  @IsIn(TERMS) term: Term;
  @IsString() start: string;
  @IsString() end: string;
}

export class SaveTermsDto {
  @Matches(/^\d{4}\/\d{4}$/, { message: 'Session must look like 2026/2027' }) session: string;
  @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => TermDatesDto) terms: TermDatesDto[];
}
