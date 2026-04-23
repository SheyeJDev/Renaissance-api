import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { PlayerCardMetadata } from '../../player-card-metadata/entities/player-card-metadata.entity';

@Entity('nft_player_cards')
@Index(['ownerId'])
@Index(['contractAddress', 'tokenId'], { unique: true })
@Index(['metadataId'])
export class NFTPlayerCard extends BaseEntity {
  @Column({ name: 'metadata_id', nullable: true })
  metadataId: string;

  @ManyToOne(() => PlayerCardMetadata, { eager: true })
  @JoinColumn({ name: 'metadata_id' })
  metadata: PlayerCardMetadata;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'contract_address' })
  contractAddress: string;

  @Column({ name: 'token_id' })
  tokenId: string;

  @Column({ name: 'acquired_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  acquiredAt: Date;

  @Column({ name: 'acquisition_price', type: 'decimal', precision: 18, scale: 8, nullable: true })
  acquisitionPrice: number;

  @Column({ name: 'is_listed', default: false })
  isListed: boolean;
}
