import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Post } from '../../posts/entities/post.entity';
import { Bet } from '../../bets/entities/bet.entity';
import { Prediction } from '../../predictions/entities/prediction.entity';
import { Comment } from '../../comments/entities/comment.entity';

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  BACKEND_EXECUTOR = 'backend_executor',
  ORACLE = 'oracle',
  EMERGENCY_PAUSE = 'emergency_pause',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
@Index(['status'])
@Index(['role'])
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  stellarAddress: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  walletBalance: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Bet, (bet) => bet.user, { cascade: true })
  bets: Bet[];

  @OneToMany(() => Prediction, (prediction) => prediction.user, {
    cascade: true,
  })
  predictions: Prediction[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];
}