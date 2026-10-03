import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveRemarksDto {
  @IsNotEmpty() @IsString() seriesId: string;
  @IsNotEmpty() @IsString() studentId: string;
  @IsOptional() @IsString() @MaxLength(300) teacherRemark?: string;
  @IsOptional() @IsString() @MaxLength(300) principalRemark?: string;
}
