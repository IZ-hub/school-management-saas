import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePaymentDto {
  @IsOptional() @IsString() feeId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) amountPaid?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}
