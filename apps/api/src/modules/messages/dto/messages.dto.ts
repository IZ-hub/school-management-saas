import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const AUDIENCES = ['ALL', 'CLASSES', 'OWING', 'ABSENT_TODAY'] as const;
export type Audience = (typeof AUDIENCES)[number];

export class ComposeDto {
  @IsIn(AUDIENCES) audience: Audience;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) classIds?: string[];
  @IsNotEmpty() @IsString() @MaxLength(612, { message: 'Keep the message to 612 characters (4 SMS pages).' }) text: string;
  @IsBoolean() sms: boolean;
}

export class SmsSettingsDto {
  @IsString() @Matches(/^[A-Za-z0-9]{20,100}$/, { message: 'Paste the API key from your Termii dashboard.' }) apiKey: string;
  @IsString() @Matches(/^[A-Za-z0-9 ]{3,11}$/, { message: 'The sender ID must be 3 to 11 letters or numbers, as approved by Termii.' }) senderId: string;
}
