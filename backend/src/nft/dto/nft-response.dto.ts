import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '../entities/nft-listing.entity';
import { OfferStatus } from '../entities/nft-offer.entity';

export class NFTOfferResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  listingId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  buyerId: string;

  @ApiProperty({ example: 'buyer123' })
  buyerUsername: string;

  @ApiProperty({ example: 95.0 })
  offerPrice: number;

  @ApiProperty({ example: 'XLM' })
  currency: string;

  @ApiProperty({ enum: OfferStatus, example: OfferStatus.PENDING })
  status: OfferStatus;

  @ApiProperty({ example: '2026-05-23T12:00:00Z' })
  expiresAt: Date;

  @ApiPropertyOptional({ example: '2026-05-20T12:00:00Z' })
  respondedAt?: Date;

  @ApiProperty({ example: '2026-04-23T12:00:00Z' })
  createdAt: Date;
}

export class NFTListingResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  nftCardId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  sellerId: string;

  @ApiProperty({ example: 'seller123' })
  sellerUsername: string;

  @ApiProperty({ example: 100.5 })
  price: number;

  @ApiProperty({ example: 'XLM' })
  currency: string;

  @ApiProperty({ enum: ListingStatus, example: ListingStatus.ACTIVE })
  status: ListingStatus;

  @ApiProperty({ example: '2026-05-23T12:00:00Z' })
  expiresAt: Date;

  @ApiPropertyOptional({ example: '0x123abc...' })
  blockchainTxHash?: string;

  @ApiPropertyOptional({ example: '2026-05-20T12:00:00Z' })
  soldAt?: Date;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003' })
  buyerId?: string;

  @ApiPropertyOptional({ example: 'buyer123' })
  buyerUsername?: string;

  @ApiPropertyOptional({ type: [NFTOfferResponseDto] })
  offers?: NFTOfferResponseDto[];

  @ApiProperty({ example: '2026-04-23T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-23T12:00:00Z' })
  updatedAt: Date;
}

export class NFTPlayerCardResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  ownerId: string;

  @ApiProperty({ example: 'owner123' })
  ownerUsername: string;

  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  contractAddress: string;

  @ApiProperty({ example: 'token-12345' })
  tokenId: string;

  @ApiProperty({ example: '2026-04-23T12:00:00Z' })
  acquiredAt: Date;

  @ApiPropertyOptional({ example: 100.0 })
  acquisitionPrice?: number;

  @ApiProperty({ example: false })
  isListed: boolean;

  @ApiPropertyOptional()
  metadata?: any;

  @ApiProperty({ example: '2026-04-23T12:00:00Z' })
  createdAt: Date;
}

export class PaginatedListingsDto {
  @ApiProperty({ type: [NFTListingResponseDto] })
  data: NFTListingResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class PaginatedNFTsDto {
  @ApiProperty({ type: [NFTPlayerCardResponseDto] })
  data: NFTPlayerCardResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
