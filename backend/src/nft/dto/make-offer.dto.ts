import { IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MakeOfferDto {
  @ApiProperty({
    description: 'Offer price',
    example: 95.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0.00000001)
  offerPrice: number;

  @ApiPropertyOptional({
    description: 'Currency for the offer',
    example: 'XLM',
    default: 'XLM',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Expiration date for the offer',
    example: '2026-05-23T12:00:00Z',
  })
  @IsDateString()
  expiresAt: string;
}
