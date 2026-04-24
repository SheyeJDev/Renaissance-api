import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces broken TableEnum / createEnum() usages with queryRunner.query()
 * so all enum types are created using raw SQL — the only supported approach
 * in TypeORM's migration API.
 */
export class FixMigrationEnumApis1775400000000 implements MigrationInterface {
  name = 'FixMigrationEnumApis1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Recreate enum types using raw SQL instead of the non-existent TableEnum / createEnum APIs.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distribution_status_enum') THEN
          CREATE TYPE "public"."distribution_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solvency_proof_status_enum') THEN
          CREATE TYPE "public"."solvency_proof_status_enum" AS ENUM ('active', 'archived', 'invalidated');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fraud_risk_level_enum') THEN
          CREATE TYPE "public"."fraud_risk_level_enum" AS ENUM ('low', 'medium', 'high', 'critical');
        END IF;
      END $$;
    `);

    // Ensure indexes are created using queryRunner.query() rather than deprecated helpers.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_distribution_status"
      ON "treasury_distributions" ("status");
    `).catch(() => { /* table may not exist in all environments */ });

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_solvency_proof_status"
      ON "solvency_proofs" ("status");
    `).catch(() => { /* table may not exist in all environments */ });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."distribution_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."solvency_proof_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."fraud_risk_level_enum"`);
  }
}
