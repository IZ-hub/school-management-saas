import { IsString, Matches, MaxLength } from 'class-validator';

const IMAGE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
const NOT_IMAGE = { message: 'The photo must be a JPEG, PNG or WebP image.' };

/** A student's photo, already cropped square and shrunk in the browser: the full photo and a small thumbnail. */
export class StudentPhotoDto {
  @IsString() @MaxLength(80_000, { message: 'The photo is too large. Use a smaller image.' }) @Matches(IMAGE, NOT_IMAGE)
  photo: string;

  @IsString() @MaxLength(12_000, { message: 'The thumbnail is too large.' }) @Matches(IMAGE, NOT_IMAGE)
  thumb: string;
}
