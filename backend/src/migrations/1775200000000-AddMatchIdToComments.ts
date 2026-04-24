import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchIdToComments1775200000000 implements MigrationInterface {
  name = 'AddMatchIdToComments1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add match_id column to comments table
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "matchId" uuid`,
    );

    // Create index on match_id
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_match_id" ON "comments" ("matchId")`,
    );

    // Add foreign key constraint for match_id
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_match_id" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // Update the status enum to include 'flagged'
    await queryRunner.query(
      `ALTER TYPE "public"."comments_status_enum" ADD VALUE IF NOT EXISTS 'flagged'`,
    );

    // Add index on author_id if it doesn't exist
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_comments_author_id" ON "comments" ("authorId")`,
    );

    // Add index on post_id if it doesn't exist
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_comments_post_id" ON "comments" ("postId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_match_id"`,
    );

    // Remove index
    await queryRunner.query(
      `DROP INDEX "IDX_comments_match_id"`,
    );

    // Remove match_id column
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN "matchId"`,
    );

    // Note: We cannot remove enum values in PostgreSQL, so 'flagged' will remain
    // This is a limitation of PostgreSQL enum types
  }
}
