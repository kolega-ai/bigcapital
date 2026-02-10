import { IsOptional, ToNumber } from '@/common/decorators/Validators';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  MinLength,
  MaxLength,
  IsBoolean,
  IsIn,
  Matches,
  IsISO4217CurrencyCode,
} from 'class-validator';
import { ACCOUNT_TYPE } from '@/constants/accounts';

export class CreateAccountDTO {
  @IsString()
  @MinLength(3)
  @MaxLength(255) // Assuming DATATYPES_LENGTH.STRING is 255
  @ApiProperty({
    description: 'Account name',
    example: 'Cash Account',
    minLength: 3,
    maxLength: 255,
  })
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]{3,6}$/, {
    message: 'Account code must be 3-6 characters containing only uppercase letters and numbers',
  })
  @ApiProperty({
    description: 'Account code (3-6 uppercase letters and numbers)',
    example: 'CA001',
    required: false,
    minLength: 3,
    maxLength: 6,
    pattern: '^[A-Z0-9]{3,6}$',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @IsISO4217CurrencyCode({
    message: 'Currency code must be a valid ISO 4217 currency code',
  })
  @ApiProperty({
    description: 'Currency code for the account (ISO 4217 format)',
    example: 'USD',
    required: false,
    pattern: '^[A-Z]{3}$',
  })
  currencyCode?: string;

  @IsString()
  @IsIn(Object.values(ACCOUNT_TYPE), {
    message: `Account type must be one of: ${Object.values(ACCOUNT_TYPE).join(', ')}`,
  })
  @ApiProperty({
    description: 'Type of account',
    example: 'cash',
    enum: Object.values(ACCOUNT_TYPE),
  })
  accountType: string;

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  @ApiProperty({
    description: 'Account description',
    example: 'Main cash account for daily operations',
    required: false,
    maxLength: 65535,
  })
  description?: string;

  @IsOptional()
  @ToNumber()
  @ApiProperty({
    description: 'ID of the parent account',
    example: 1,
    required: false,
  })
  parentAccountId?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'Whether the account is active',
    example: true,
    required: false,
    default: true,
  })
  active?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Plaid account ID for syncing',
    example: 'plaid_account_123456',
    required: false,
  })
  plaidAccountId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Plaid item ID for syncing',
    example: 'plaid_item_123456',
    required: false,
  })
  plaidItemId?: string;
}
