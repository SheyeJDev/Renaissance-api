import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum AdminActionType {
  BET_CANCELLED = 'bet_cancelled',
  BALANCE_CORRECTED = 'balance_corrected',
  MATCH_CORRECTED = 'match_corrected',
  COMMENT_APPROVED = 'comment_approved',
  COMMENT_REJECTED = 'comment_rejected',
  COMMENT_FLAGGED = 'comment_flagged',
  COMMENT_DELETED = 'comment_deleted',
}

@Entity('admin_audit_logs')
@Index(['adminId'])
@Index(['actionType'])
@Index(['createdAt'])
@Index(['affectedUserId'])
@Index(['adminId', 'createdAt'])
@Index(['actionType', 'createdAt'])
export class AdminAuditLog extends BaseEntity {
  @Column({ name: 'admin_id' })
  adminId: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: AdminActionType,
  })
  actionType: AdminActionType;

  @Column({ name: 'affected_user_id', nullable: true })
  affectedUserId: string;

  @Column({ name: 'affected_entity_id', nullable: true })
  affectedEntityId: string;

  @Column({
    name: 'affected_entity_type',
    nullable: true,
    comment: 'Type of affected entity: bet, match, user, etc.',
  })
  affectedEntityType: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'json', nullable: true })
  previousValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_id' })
  admin: User;
}
