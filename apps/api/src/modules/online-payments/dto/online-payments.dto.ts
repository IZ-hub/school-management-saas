import { IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SavePaystackKeyDto {
  @IsString() @Matches(/^sk_(live|test)_[A-Za-z0-9]{20,}$/, { message: 'Paste the secret key from Paystack. It starts with sk_live_ or sk_test_.' })
  secretKey: string;
}

export class StartPaymentDto {
  @Type(() => Number) @IsInt({ message: 'Enter the amount in whole naira' }) @Min(100, { message: 'The smallest online payment is ₦100.' }) @Max(10_000_000) amount: number;
}

export class VerifyPaymentDto {
  @IsNotEmpty() @IsString() @MaxLength(100) reference: string;
}
