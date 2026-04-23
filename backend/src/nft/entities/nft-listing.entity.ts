import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { NFTPlayerCard } from './nft-player-card.entity';

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('nft_listings')
@Index(['sellerId'])
@Index(['nftCardId'])
@Index(['status'])
@Index(['expiresAt'])
@Index(['status', 'expiresAt'])
export class NFTListing extends BaseEntity {
  @Column({ name: 'nft_card_id' })
  nftCardId: string;

  @ManyToOne(() => NFTPlayerCard, { eager: true })
  @JoinColumn({ name: 'nft_card_id' })
  nftCard: NFTPlayerCard;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ default: 'XLM' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.ACTIVE,
  })
  status: ListingStatus;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'blockchain_tx_hash', nullable: true })
  blockchainTxHash: string;

  @Column({ name: 'sold_at', type: 'timestamp', nullable: true })
  soldAt: Date;

  @Column({ name: 'buyer_id', nullable: true })
  buyerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;
}
