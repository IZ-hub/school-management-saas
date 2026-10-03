import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class InviteParentDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(120) email: string;
  @IsNotEmpty() @IsString() @MaxLength(60) firstName: string;
  @IsNotEmpty() @IsString() @MaxLength(60) lastName: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
