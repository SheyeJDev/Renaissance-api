# Comments System Implementation

## Overview
Complete implementation of a comments system allowing users to comment on posts and matches with moderation capabilities and audit logging.

## Files Created/Modified

### New Files Created:
1. **`backend/src/comments/entities/comment.entity.ts`** - Comment entity with relationships
2. **`backend/src/comments/dto/create-comment.dto.ts`** - DTOs for comment operations
3. **`backend/src/comments/comments.service.ts`** - Business logic service
4. **`backend/src/comments/comments.controller.ts`** - REST API endpoints
5. **`backend/src/comments/comments.module.ts`** - Module configuration
6. **`backend/src/migrations/1775200000000-AddMatchIdToComments.ts`** - Database migration

### Files Modified:
1. **`backend/src/users/entities/user.entity.ts`** - Added comments relationship
2. **`backend/src/posts/entities/post.entity.ts`** - Added comments relationship
3. **`backend/src/matches/entities/match.entity.ts`** - Added comments relationship
4. **`backend/src/admin/entities/admin-audit-log.entity.ts`** - Added comment moderation action types
5. **`backend/src/app.module.ts`** - Registered CommentsModule and Comment entity

## Features Implemented

### 1. CRUD Operations for Users
✅ **Create Comment**: Users can create comments on posts or matches
- Endpoint: `POST /comments`
- Comments start with `pending` status by default
- Supports nested replies via `parentId`

✅ **Read Comments**: Users can view comments with filtering
- Endpoint: `GET /comments`
- Filter by: postId, matchId, authorId, status, parentId
- Pagination support (page, limit)
- By default, only shows approved comments

✅ **Update Comment**: Users can update their own comments
- Endpoint: `PATCH /comments/:id`
- Only the author can update their comment
- Cannot update deleted comments

✅ **Delete Comment**: Users can delete their own comments
- Endpoint: `DELETE /comments/:id`
- Only the author can delete their comment
- Moderators/Admins can delete any comment
- Soft delete (status changed to 'deleted')

### 2. Moderation Features
✅ **Flag Comment**: Users can flag inappropriate comments
- Endpoint: `POST /comments/:id/flag`
- Users cannot flag their own comments
- Changes status to 'flagged' for moderator review

✅ **Moderate Comment**: Moderators/Admins can approve/reject/delete comments
- Endpoint: `PATCH /comments/:id/moderate`
- Requires MODERATOR or ADMIN role
- Actions: approve, reject, delete, flag
- Optional reason field for documentation

✅ **Comment Statistics**: Admins can view comment analytics
- Endpoint: `GET /comments/stats`
- Requires ADMIN role
- Returns: total count, breakdown by status, recent activity

### 3. Audit Logging
✅ **All Moderation Actions Logged**
- Comment approvals
- Comment rejections
- Comment flags
- Comment deletions
- Logs include: moderator ID, previous status, new status, reason, timestamp

### 4. Database Schema
✅ **Comment Entity**
- id (UUID, primary key)
- content (text, required)
- status (enum: pending, approved, rejected, flagged, deleted)
- likes (integer, default: 0)
- parentId (UUID, for nested replies)
- authorId (UUID, foreign key to users)
- postId (UUID, foreign key to posts)
- matchId (UUID, foreign key to matches)
- createdAt, updatedAt, deletedAt (timestamps)

✅ **Indexes**
- status, createdAt, updatedAt
- authorId, postId, matchId, parentId
- Optimized for common query patterns

## API Endpoints

### Public/User Endpoints (Requires JWT Authentication)
```
POST   /comments              - Create a comment
GET    /comments              - Get comments with filters
GET    /comments/:id          - Get comment by ID
PATCH  /comments/:id          - Update own comment
DELETE /comments/:id          - Delete own comment
POST   /comments/:id/flag     - Flag a comment
```

### Moderator/Admin Endpoints
```
PATCH  /comments/:id/moderate - Moderate a comment (MODERATOR, ADMIN)
GET    /comments/stats        - Get comment statistics (ADMIN)
```

## Comment Status Flow
```
pending → approved (moderator action)
pending → rejected (moderator action)
any → flagged (user or moderator action)
any → deleted (author, moderator, or admin action)
```

## Acceptance Criteria Verification

✅ **Users can create, read, update, delete comments**
- All CRUD operations implemented
- Proper authorization checks in place
- Validation via DTOs

✅ **Moderators can flag/approve/delete comments**
- ModerateCommentDto for status changes
- Role-based access control (MODERATOR, ADMIN)
- Flag endpoint for user reporting

✅ **Audit logs for all moderation actions**
- Integrated with AdminAuditService
- Logs created for: approve, reject, flag, delete
- Includes moderator ID, reason, previous/new status
- Accessible via admin audit log endpoints

## Usage Examples

### Create a Comment on a Post
```bash
POST /comments
Authorization: Bearer <token>
{
  "content": "Great analysis on this match!",
  "postId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Create a Reply to a Comment
```bash
POST /comments
Authorization: Bearer <token>
{
  "content": "I agree with your point!",
  "parentId": "456e7890-e12b-34d5-a678-901234567890"
}
```

### Get Comments for a Match
```bash
GET /comments?matchId=123e4567-e89b-12d3-a456-426614174000&page=1&limit=20
Authorization: Bearer <token>
```

### Flag a Comment
```bash
POST /comments/789e0123-f45b-67c8-d901-234567890abc/flag
Authorization: Bearer <token>
```

### Moderate a Comment (Moderator/Admin Only)
```bash
PATCH /comments/789e0123-f45b-67c8-d901-234567890abc/moderate
Authorization: Bearer <moderator-token>
{
  "status": "approved",
  "reason": "Comment follows community guidelines"
}
```

## Database Migration

Run the migration to update the database schema:
```bash
npm run migration:run
```

This will:
- Add `matchId` column to comments table
- Create indexes for performance
- Add foreign key constraint to matches table
- Update status enum to include 'flagged'

## Next Steps

1. Run database migration
2. Test all endpoints with Postman or similar tool
3. Verify audit logs are created for moderation actions
4. Test role-based access control
5. Add unit and integration tests
6. Consider adding rate limiting for comment creation
7. Consider adding content moderation filters (profanity, spam detection)
