import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { NFTListing } from './nft-listing.entity';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('nft_offers')
@Index(['listingId'])
@Index(['buyerId'])
@Index(['status'])
@Index(['expiresAt'])
@Index(['status', 'expiresAt'])
export class NFTOffer extends BaseEntity {
  @Column({ name: 'listing_id' })
  listingId: string;

  @ManyToOne(() => NFTListing, { eager: true })
  @JoinColumn({ name: 'listing_id' })
  listing: NFTListing;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'offer_price', type: 'decimal', precision: 18, scale: 8 })
  offerPrice: number;

  @Column({ default: 'XLM' })
  currency: string;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date;
}
