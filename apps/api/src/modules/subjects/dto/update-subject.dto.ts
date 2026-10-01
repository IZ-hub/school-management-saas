import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  /** "ACTIVE" restores an archived subject; archiving is done with DELETE. */
  @IsOptional() @IsIn(['ACTIVE']) status?: 'ACTIVE';
}
