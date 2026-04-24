import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  ModerateCommentDto,
  FilterCommentsDto,
} from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Comments')
@Controller('comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new comment',
    description:
      'Creates a new comment on a post or match. Comments start with pending status.',
  })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({
    status: 201,
    description: 'Comment successfully created',
    type: Comment,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Parent comment not found (if replying)',
  })
  async createComment(
    @Req() req: AuthenticatedRequest,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.createComment(req.user.userId, createCommentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get comments with filters',
    description:
      'Retrieves comments with optional filtering by post, match, author, or status.',
  })
  @ApiQuery({ type: FilterCommentsDto })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully',
    schema: {
      example: {
        comments: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            content: 'Great analysis!',
            status: 'approved',
            likes: 5,
            author: {
              id: '456e7890-e12b-34d5-a678-901234567890',
              username: 'john_doe',
            },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 50,
        page: 1,
        limit: 20,
      },
    },
  })
  async getComments(
    @Query() filters: FilterCommentsDto,
  ): Promise<{ comments: Comment[]; total: number; page: number; limit: number }> {
    return this.commentsService.getComments(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific comment by ID',
    description: 'Retrieves detailed information about a comment including replies.',
  })
  @ApiParam({
    name: 'id',
    description: 'Comment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Comment found',
    type: Comment,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
  })
  async getCommentById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Comment> {
    return this.commentsService.getCommentById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a comment (Owner only)',
    description: 'Updates an existing comment. User can only update their own comments.',
  })
  @ApiParam({
    name: 'id',
    description: 'Comment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({
    status: 200,
    description: 'Comment successfully updated',
    type: Comment,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only update own comments',
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
  })
  async updateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.updateComment(id, req.user.userId, updateCommentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a comment',
    description:
      'Deletes a comment. Users can delete their own comments. Moderators and admins can delete any comment.',
  })
  @ApiParam({
    name: 'id',
    description: 'Comment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Comment successfully deleted',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
  })
  async deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.commentsService.deleteComment(id, req.user.userId, req.user.role);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flag a comment for moderation',
    description: 'Flags a comment for review by moderators. Users cannot flag their own comments.',
  })
  @ApiParam({
    name: 'id',
    description: 'Comment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Comment flagged successfully',
    type: Comment,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cannot flag own comment',
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
  })
  async flagComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Comment> {
    return this.commentsService.flagComment(id, req.user.userId);
  }

  @Patch(':id/moderate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Moderate a comment (Moderator/Admin only)',
    description:
      'Allows moderators and admins to approve, reject, or delete comments. Requires moderator or admin role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Comment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: ModerateCommentDto })
  @ApiResponse({
    status: 200,
    description: 'Comment moderation status updated',
    type: Comment,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - moderator or admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found',
  })
  async moderateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() moderateCommentDto: ModerateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.moderateComment(id, moderateCommentDto, req.user.userId);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get comment statistics (Admin only)',
    description: 'Retrieves statistics about comments including counts by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Comment statistics retrieved successfully',
    schema: {
      example: {
        total: 1000,
        byStatus: {
          approved: 800,
          pending: 100,
          flagged: 50,
          rejected: 30,
          deleted: 20,
        },
        recentCount: 45,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin role required',
  })
  async getCommentStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    recentCount: number;
  }> {
    return this.commentsService.getCommentStats();
  }
}
