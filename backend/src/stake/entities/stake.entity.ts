import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('stakes')
export class Stake {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  playerId!: string;

  @Column('decimal', { precision: 18, scale: 6 })
  amount!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  pendingRewards!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  totalClaimed!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  compoundedAmount!: number;

  @Column({ default: true })
  active!: boolean;

  @Column({ nullable: true })
  stellarTxHash!: string; // hash from Stellar contract

  @Column({ nullable: true })
  unstakedAt!: Date;

  @CreateDateColumn()
  stakedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}