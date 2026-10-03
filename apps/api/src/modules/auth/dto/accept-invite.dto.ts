import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsNotEmpty() @IsString() @MaxLength(200) code: string;
  @IsString() @MinLength(8, { message: 'Use at least 8 characters for your password.' }) @MaxLength(100) password: string;
}
