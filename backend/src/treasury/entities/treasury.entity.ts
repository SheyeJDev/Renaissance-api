import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type DistributionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

@Entity('treasury_distributions')
export class TreasuryDistribution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('decimal', { precision: 18, scale: 6 })
  totalAmount!: number;

  @Column({ default: 0 })
  recipientCount!: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: DistributionStatus;

  @Column({ nullable: true })
  failureReason!: string;

  @Column({ nullable: true })
  processedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('treasury_distribution_items')
export class TreasuryDistributionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  distributionId!: string;

  @ManyToOne(() => TreasuryDistribution)
  @JoinColumn({ name: 'distributionId' })
  distribution!: TreasuryDistribution;

  @Column('uuid')
  playerId!: string;

  @Column('decimal', { precision: 18, scale: 6 })
  amount!: number;

  @Column({ default: false })
  credited!: boolean;

  @Column({ nullable: true })
  creditedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}