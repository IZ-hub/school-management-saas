import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

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
