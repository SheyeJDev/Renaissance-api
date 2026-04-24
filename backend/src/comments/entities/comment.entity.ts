import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Match } from '../../matches/entities/match.entity';

export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  DELETED = 'deleted',
}

@Entity('comments')
@Index(['status'])
@Index(['createdAt'])
@Index(['updatedAt'])
@Index(['authorId'])
@Index(['postId'])
@Index(['matchId'])
@Index(['parentId'])
export class Comment extends BaseEntity {
  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: CommentStatus,
    default: CommentStatus.PENDING,
  })
  status: CommentStatus;

  @Column({ default: 0 })
  likes: number;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @Column({ name: 'author_id', nullable: true })
  authorId: string;

  @Column({ name: 'post_id', nullable: true })
  postId: string;

  @Column({ name: 'match_id', nullable: true })
  matchId: string;

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];

  @ManyToOne(() => User, (user) => user.comments, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ManyToOne(() => Post, (post) => post.comments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => Match, (match) => match.comments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'match_id' })
  match: Match;
}
