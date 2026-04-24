import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { AdminAuditService } from '../auth/services/admin-audit.service';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, AdminAuditLog])],
  controllers: [CommentsController],
  providers: [CommentsService, AdminAuditService],
  exports: [CommentsService],
})
export class CommentsModule {}
