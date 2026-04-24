import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletConnectionManagement1745496000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isDefault column
    await queryRunner.query(`
      ALTER TABLE wallet_connections
        ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false
    `);

    // Add new wallet types and disconnected status
    await queryRunner.query(`
      ALTER TABLE wallet_connections
        ALTER COLUMN "walletType" TYPE varchar,
        ALTER COLUMN "status" TYPE varchar
    `);

    // Drop old enums if they exist and recreate with new values
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_connections_wallettype_enum') THEN
          ALTER TABLE wallet_connections ALTER COLUMN "walletType" DROP DEFAULT;
          ALTER TABLE wallet_connections ALTER COLUMN "walletType" TYPE wallet_connections_wallettype_enum
            USING "walletType"::wallet_connections_wallettype_enum;
        END IF;
      END $$;
    `);

    // Remove old unique constraint on publicKey alone, add composite unique
    await queryRunner.query(`
      ALTER TABLE wallet_connections DROP CONSTRAINT IF EXISTS "UQ_wallet_connections_publicKey"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wallet_connections_userId_publicKey"
        ON wallet_connections ("userId", "publicKey")
    `);

    // Add DISCONNECTED to status enum
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE wallet_connections_status_enum ADD VALUE IF NOT EXISTS 'disconnected';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new wallet types
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE wallet_connections_wallettype_enum ADD VALUE IF NOT EXISTS 'xbull';
        ALTER TYPE wallet_connections_wallettype_enum ADD VALUE IF NOT EXISTS 'lobstr';
        ALTER TYPE wallet_connections_wallettype_enum ADD VALUE IF NOT EXISTS 'other';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE wallet_connections DROP COLUMN IF EXISTS "isDefault"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wallet_connections_userId_publicKey"`);
  }
}
