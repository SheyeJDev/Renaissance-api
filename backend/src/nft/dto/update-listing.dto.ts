import { IsNumber, IsOptional, Min, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateListingDto {
  @ApiPropertyOptional({
    description: 'Updated listing price',
    example: 120.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  price?: number;

  @ApiPropertyOptional({
    description: 'Updated expiration date',
    example: '2026-06-23T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
