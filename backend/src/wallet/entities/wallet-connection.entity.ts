import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WalletType {
  FREIGHTER = 'freighter',
  XBULL = 'xbull',
  LOBSTR = 'lobstr',
  OTHER = 'other',
}

export enum WalletStatus {
  ACTIVE = 'active',
  DISCONNECTED = 'disconnected',
}

@Entity('wallet_connections')
@Index(['userId', 'publicKey'], { unique: true })
export class WalletConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  publicKey: string;

  @Column({ type: 'enum', enum: WalletType, default: WalletType.FREIGHTER })
  walletType: WalletType;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
