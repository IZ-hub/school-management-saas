import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsNotEmpty() @IsString() feeId: string;
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsNumber() @Type(() => Number) amountPaid: number;
  @IsNotEmpty() @IsString() method: string;
  @IsOptional() @IsString() reference?: string;
}
