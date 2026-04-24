import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionSource {
  BET = 'bet',
  WITHDRAWAL = 'withdrawal',
  WINNING = 'winning',
  STAKE = 'stake',
  NFT_PURCHASE = 'nft_purchase',
  NFT_SALE = 'nft_sale',
  NFT_OFFER = 'nft_offer',
}

@Entity('balance_transactions')
export class BalanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionSource })
  source: TransactionSource;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  previousBalance: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  newBalance: number;

  @CreateDateColumn()
  createdAt: Date;
}