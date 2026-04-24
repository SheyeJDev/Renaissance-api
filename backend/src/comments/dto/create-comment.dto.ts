import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentStatus } from '../entities/comment.entity';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'Great analysis on this match!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Parent comment ID for replies',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Post ID to comment on',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  postId?: string;

  @ApiPropertyOptional({
    description: 'Match ID to comment on',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  matchId?: string;
}

export class UpdateCommentDto {
  @ApiPropertyOptional({
    description: 'Updated comment content',
    example: 'Updated comment text',
  })
  @IsString()
  @IsOptional()
  content?: string;
}

export class ModerateCommentDto {
  @ApiProperty({
    description: 'New status for the comment',
    enum: CommentStatus,
    example: 'approved',
  })
  @IsEnum(CommentStatus)
  @IsNotEmpty()
  status: CommentStatus;

  @ApiPropertyOptional({
    description: 'Reason for moderation action',
    example: 'Comment violates community guidelines',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class FilterCommentsDto {
  @ApiPropertyOptional({
    description: 'Filter by post ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  postId?: string;

  @ApiPropertyOptional({
    description: 'Filter by match ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  matchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by author ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: CommentStatus,
    example: 'approved',
  })
  @IsEnum(CommentStatus)
  @IsOptional()
  status?: CommentStatus;

  @ApiPropertyOptional({
    description: 'Parent comment ID to get replies',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
