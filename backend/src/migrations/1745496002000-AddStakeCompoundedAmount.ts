import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStakeCompoundedAmount1745496002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stakes
        ADD COLUMN IF NOT EXISTS "compoundedAmount" DECIMAL(18,6) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE stakes DROP COLUMN IF EXISTS "compoundedAmount"`);
  }
}
