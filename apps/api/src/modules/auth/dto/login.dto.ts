import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  /** Only needed when the same email belongs to users at more than one school. */
  @IsOptional()
  @IsString()
  schoolId?: string;
}
