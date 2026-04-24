import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Comment, CommentStatus } from './entities/comment.entity';
import { CreateCommentDto, UpdateCommentDto, ModerateCommentDto, FilterCommentsDto } from './dto/create-comment.dto';
import { AdminAuditService } from '../auth/services/admin-audit.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  async createComment(
    userId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const { content, parentId, postId, matchId } = createCommentDto;

    // Validate that either postId or matchId is provided
    if (!postId && !matchId) {
      throw new BadRequestException(
        'Either postId or matchId must be provided',
      );
    }

    // If it's a reply, verify parent comment exists
    if (parentId) {
      const parentComment = await this.commentsRepository.findOne({
        where: { id: parentId },
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = this.commentsRepository.create({
      content,
      parentId,
      postId,
      matchId,
      authorId: userId,
      status: CommentStatus.PENDING,
    });

    const savedComment = await this.commentsRepository.save(comment);
    this.logger.log(`Comment created by user ${userId}: ${savedComment.id}`);

    return savedComment;
  }

  async getComments(filters: FilterCommentsDto): Promise<{
    comments: Comment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { postId, matchId, authorId, status, parentId, page = 1, limit = 20 } = filters;

    const query = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('1=1');

    if (postId) {
      query.andWhere('comment.postId = :postId', { postId });
    }

    if (matchId) {
      query.andWhere('comment.matchId = :matchId', { matchId });
    }

    if (authorId) {
      query.andWhere('comment.authorId = :authorId', { authorId });
    }

    if (status) {
      query.andWhere('comment.status = :status', { status });
    } else {
      // By default, only show approved comments
      query.andWhere('comment.status = :status', { status: CommentStatus.APPROVED });
    }

    if (parentId) {
      query.andWhere('comment.parentId = :parentId', { parentId });
    } else {
      // By default, only show top-level comments (not replies)
      query.andWhere('comment.parentId IS NULL');
    }

    query.orderBy('comment.createdAt', 'DESC');

    const total = await query.getCount();
    const offset = (page - 1) * limit;
    query.skip(offset).take(limit);

    const comments = await query.getMany();

    return {
      comments,
      total,
      page,
      limit,
    };
  }

  async getCommentById(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author', 'post', 'match', 'replies'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  async updateComment(
    id: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.getCommentById(id);

    // Only the author can update their comment
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    // Cannot update deleted comments
    if (comment.status === CommentStatus.DELETED) {
      throw new ForbiddenException('Cannot update a deleted comment');
    }

    Object.assign(comment, updateCommentDto);
    const updatedComment = await this.commentsRepository.save(comment);
    this.logger.log(`Comment updated by user ${userId}: ${id}`);

    return updatedComment;
  }

  async deleteComment(id: string, userId: string, userRole: UserRole): Promise<void> {
    const comment = await this.getCommentById(id);

    // Only the author or moderators/admins can delete comments
    if (
      comment.authorId !== userId &&
      userRole !== UserRole.MODERATOR &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    comment.status = CommentStatus.DELETED;
    await this.commentsRepository.save(comment);
    this.logger.log(`Comment deleted by user ${userId}: ${id}`);
  }

  async moderateComment(
    id: string,
    moderateCommentDto: ModerateCommentDto,
    moderatorId: string,
  ): Promise<Comment> {
    const comment = await this.getCommentById(id);
    const { status, reason } = moderateCommentDto;

    const previousStatus = comment.status;
    comment.status = status;
    
    const updatedComment = await this.commentsRepository.save(comment);

    // Log the moderation action
    await this.adminAuditService.logAction({
      userId: moderatorId,
      action: `comment_${status}`,
      targetResource: 'comment',
      resourceId: id,
      targetUserId: comment.authorId,
      changes: {
        previousStatus,
        newStatus: status,
        reason,
      },
      metadata: {
        commentContent: comment.content.substring(0, 100),
      },
    });

    this.logger.log(
      `Comment ${id} moderated to ${status} by moderator ${moderatorId}`,
    );

    return updatedComment;
  }

  async flagComment(id: string, userId: string): Promise<Comment> {
    const comment = await this.getCommentById(id);

    // Users can flag comments (but not their own)
    if (comment.authorId === userId) {
      throw new ForbiddenException('You cannot flag your own comment');
    }

    comment.status = CommentStatus.FLAGGED;
    const updatedComment = await this.commentsRepository.save(comment);

    this.logger.log(`Comment ${id} flagged by user ${userId}`);

    return updatedComment;
  }

  async getCommentStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    recentCount: number;
  }> {
    const total = await this.commentsRepository.count();
    
    const byStatus = await this.commentsRepository
      .createQueryBuilder('comment')
      .select('comment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('comment.status')
      .getRawMany();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentCount = await this.commentsRepository
      .createQueryBuilder('comment')
      .where('comment.createdAt >= :date', { date: oneDayAgo })
      .getCount();

    const statusMap = byStatus.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byStatus: statusMap,
      recentCount,
    };
  }
}
