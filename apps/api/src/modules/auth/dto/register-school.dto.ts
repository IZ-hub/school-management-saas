import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterSchoolDto {
  @IsNotEmpty()
  @IsString()
  schoolName: string;

  @IsEmail()
  schoolEmail: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  schoolType?: string;

  @IsNotEmpty()
  @IsString()
  ownerFirstName: string;

  @IsNotEmpty()
  @IsString()
  ownerLastName: string;

  @IsEmail()
  ownerEmail: string;

  @MinLength(6)
  @IsString()
  ownerPassword: string;
}
