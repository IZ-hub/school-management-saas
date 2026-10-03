import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TERMS, Term } from '../../../common/school-date';

/** Methods a person can record by hand. Online payments are recorded by Paystack confirmations only. */
export const METHODS = ['CASH', 'TRANSFER', 'POS', 'CHEQUE'] as const;

export class RecordPaymentDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsIn(TERMS) term: Term;
  @Matches(/^\d{4}\/\d{4}$/, { message: 'Session must look like 2026/2027' }) session: string;
  @Type(() => Number) @IsInt({ message: 'Enter the amount in whole naira' }) @Min(1) @Max(100_000_000) amount: number;
  @IsIn(METHODS) method: (typeof METHODS)[number];
  @IsNotEmpty() @IsString() paidOn: string;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class VoidPaymentDto {
  @IsNotEmpty() @IsString() @MaxLength(200) reason: string;
}
