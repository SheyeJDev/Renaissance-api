import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  stellarAddress!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  // Denormalised stats — updated on each relevant event
  @Column('int', { default: 0 })
  totalSpins!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  totalWagered!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  totalWon!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  walletBalance!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}