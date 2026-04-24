import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateParlayBetsTables1745496001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE parlay_status_enum AS ENUM ('pending', 'won', 'lost', 'void', 'partial_void')
    `);

    await queryRunner.query(`
      CREATE TYPE selection_status_enum AS ENUM ('pending', 'won', 'lost', 'void')
    `);

    await queryRunner.query(`
      CREATE TABLE parlay_bets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        reference VARCHAR NOT NULL UNIQUE,
        "stakeAmount" DECIMAL(18,8) NOT NULL,
        "combinedOdds" DECIMAL(18,8) NOT NULL,
        "potentialPayout" DECIMAL(18,8) NOT NULL,
        status parlay_status_enum NOT NULL DEFAULT 'pending',
        "settledAt" TIMESTAMP,
        metadata JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE parlay_selections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "parlayId" UUID NOT NULL REFERENCES parlay_bets(id) ON DELETE CASCADE,
        "matchId" UUID NOT NULL,
        "predictedOutcome" VARCHAR NOT NULL,
        odds DECIMAL(8,3) NOT NULL,
        status selection_status_enum NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX ON parlay_bets ("userId")`);
    await queryRunner.query(`CREATE INDEX ON parlay_selections ("parlayId")`);
    await queryRunner.query(`CREATE INDEX ON parlay_selections ("matchId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS parlay_selections`);
    await queryRunner.query(`DROP TABLE IF EXISTS parlay_bets`);
    await queryRunner.query(`DROP TYPE IF EXISTS selection_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS parlay_status_enum`);
  }
}
