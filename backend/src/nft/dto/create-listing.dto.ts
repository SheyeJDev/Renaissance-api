import { IsString, IsNumber, IsOptional, IsDateString, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({
    description: 'NFT Player Card ID to list for sale',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  nftCardId: string;

  @ApiProperty({
    description: 'Listing price',
    example: 100.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0.00000001)
  price: number;

  @ApiPropertyOptional({
    description: 'Currency for the listing',
    example: 'XLM',
    default: 'XLM',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Expiration date for the listing',
    example: '2026-05-23T12:00:00Z',
  })
  @IsDateString()
  expiresAt: string;
}
