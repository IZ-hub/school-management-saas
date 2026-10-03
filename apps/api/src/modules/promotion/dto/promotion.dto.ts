import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ClassMoveDto {
  @IsNotEmpty() @IsString() fromClassId: string;
  /** Another class's id, "GRADUATE" (leaves the school) or "STAY" (repeats the class). */
  @IsNotEmpty() @IsString() to: string;
}

export class ApplyPromotionDto {
  /** The session students are moving into, e.g. 2027/2028. */
  @Matches(/^\d{4}\/\d{4}$/, { message: 'Session must look like 2027/2028' }) toSession: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ClassMoveDto) moves: ClassMoveDto[];
  /** Students who repeat their class whatever their class's move. */
  @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) holdBack: string[];
}
