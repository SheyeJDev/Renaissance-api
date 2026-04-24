import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrizeVestingsTable1745496003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE vesting_status_enum AS ENUM ('active', 'completed', 'early_claimed')
    `);

    await queryRunner.query(`
      CREATE TABLE prize_vestings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "sourceReference" VARCHAR NOT NULL,
        "totalAmount" DECIMAL(18,8) NOT NULL,
        "releasedAmount" DECIMAL(18,8) NOT NULL DEFAULT 0,
        "dailyRelease" DECIMAL(18,8) NOT NULL,
        status vesting_status_enum NOT NULL DEFAULT 'active',
        "vestingStartDate" TIMESTAMP NOT NULL,
        "vestingEndDate" TIMESTAMP NOT NULL,
        "lastReleaseDate" TIMESTAMP,
        metadata JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX ON prize_vestings ("userId")`);
    await queryRunner.query(`CREATE INDEX ON prize_vestings (status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS prize_vestings`);
    await queryRunner.query(`DROP TYPE IF EXISTS vesting_status_enum`);
  }
}
