import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VestingStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EARLY_CLAIMED = 'early_claimed',
}

/** Payouts > 10,000 XLM vest over 30 days with daily release */
@Entity('prize_vestings')
export class PrizeVesting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** Reference to the originating bet/parlay */
  @Column()
  sourceReference: string;

  @Column('decimal', { precision: 18, scale: 8 })
  totalAmount: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  releasedAmount: number;

  /** Daily release = totalAmount / 30 */
  @Column('decimal', { precision: 18, scale: 8 })
  dailyRelease: number;

  @Column({ type: 'enum', enum: VestingStatus, default: VestingStatus.ACTIVE })
  status: VestingStatus;

  @Column()
  vestingStartDate: Date;

  @Column()
  vestingEndDate: Date;

  @Column({ nullable: true })
  lastReleaseDate: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
