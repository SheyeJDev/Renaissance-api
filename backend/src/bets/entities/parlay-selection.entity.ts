import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ParlayBet } from './parlay-bet.entity';
import { MatchOutcome } from '../../common/enums/match.enums';

export enum SelectionStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  VOID = 'void',
}

@Entity('parlay_selections')
export class ParlaySelection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  parlayId: string;

  @Column()
  matchId: string;

  @Column({ type: 'enum', enum: MatchOutcome })
  predictedOutcome: MatchOutcome;

  @Column('decimal', { precision: 8, scale: 3 })
  odds: number;

  @Column({ type: 'enum', enum: SelectionStatus, default: SelectionStatus.PENDING })
  status: SelectionStatus;

  @ManyToOne(() => ParlayBet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parlayId' })
  parlay: ParlayBet;

  @CreateDateColumn()
  createdAt: Date;
}
