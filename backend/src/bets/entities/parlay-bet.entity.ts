import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum ParlayStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  VOID = 'void',
  PARTIAL_VOID = 'partial_void',
}

@Entity('parlay_bets')
export class ParlayBet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ unique: true })
  reference: string;

  @Column('decimal', { precision: 18, scale: 8 })
  stakeAmount: number;

  /** Product of all individual odds */
  @Column('decimal', { precision: 18, scale: 8 })
  combinedOdds: number;

  @Column('decimal', { precision: 18, scale: 8 })
  potentialPayout: number;

  @Column({ type: 'enum', enum: ParlayStatus, default: ParlayStatus.PENDING })
  status: ParlayStatus;

  @Column({ nullable: true })
  settledAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
