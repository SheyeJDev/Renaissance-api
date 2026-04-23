import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNFTMarketplaceTables1769500000000 implements MigrationInterface {
  name = 'CreateNFTMarketplaceTables1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create nft_player_cards table
    await queryRunner.query(`
      CREATE TABLE "nft_player_cards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "metadata_id" uuid,
        "owner_id" uuid NOT NULL,
        "contract_address" character varying NOT NULL,
        "token_id" character varying NOT NULL,
        "acquired_at" TIMESTAMP NOT NULL DEFAULT now(),
        "acquisition_price" decimal(18,8),
        "is_listed" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_nft_player_cards" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for nft_player_cards
    await queryRunner.query(`CREATE INDEX "IDX_nft_player_cards_owner_id" ON "nft_player_cards" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_player_cards_metadata_id" ON "nft_player_cards" ("metadata_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_nft_player_cards_contract_token" ON "nft_player_cards" ("contract_address", "token_id")`);

    // Create nft_listings table
    await queryRunner.query(`
      CREATE TABLE "nft_listings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "nft_card_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "price" decimal(18,8) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'XLM',
        "status" character varying NOT NULL DEFAULT 'active',
        "expires_at" TIMESTAMP NOT NULL,
        "blockchain_tx_hash" character varying,
        "sold_at" TIMESTAMP,
        "buyer_id" uuid,
        CONSTRAINT "PK_nft_listings" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for nft_listings
    await queryRunner.query(`CREATE INDEX "IDX_nft_listings_seller_id" ON "nft_listings" ("seller_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_listings_nft_card_id" ON "nft_listings" ("nft_card_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_listings_status" ON "nft_listings" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_listings_expires_at" ON "nft_listings" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_listings_status_expires" ON "nft_listings" ("status", "expires_at")`);

    // Create nft_offers table
    await queryRunner.query(`
      CREATE TABLE "nft_offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "listing_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        "offer_price" decimal(18,8) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'XLM',
        "status" character varying NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP NOT NULL,
        "responded_at" TIMESTAMP,
        CONSTRAINT "PK_nft_offers" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for nft_offers
    await queryRunner.query(`CREATE INDEX "IDX_nft_offers_listing_id" ON "nft_offers" ("listing_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_offers_buyer_id" ON "nft_offers" ("buyer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_offers_status" ON "nft_offers" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_offers_expires_at" ON "nft_offers" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_nft_offers_status_expires" ON "nft_offers" ("status", "expires_at")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "nft_player_cards"
      ADD CONSTRAINT "FK_nft_player_cards_owner"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_player_cards"
      ADD CONSTRAINT "FK_nft_player_cards_metadata"
      FOREIGN KEY ("metadata_id") REFERENCES "player_card_metadata"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_listings"
      ADD CONSTRAINT "FK_nft_listings_nft_card"
      FOREIGN KEY ("nft_card_id") REFERENCES "nft_player_cards"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_listings"
      ADD CONSTRAINT "FK_nft_listings_seller"
      FOREIGN KEY ("seller_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_listings"
      ADD CONSTRAINT "FK_nft_listings_buyer"
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_offers"
      ADD CONSTRAINT "FK_nft_offers_listing"
      FOREIGN KEY ("listing_id") REFERENCES "nft_listings"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nft_offers"
      ADD CONSTRAINT "FK_nft_offers_buyer"
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Update balance_transactions enum to include NFT transaction types
    await queryRunner.query(`
      ALTER TYPE "public"."balance_transactions_source_enum"
      ADD VALUE IF NOT EXISTS 'nft_purchase'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."balance_transactions_source_enum"
      ADD VALUE IF NOT EXISTS 'nft_sale'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."balance_transactions_source_enum"
      ADD VALUE IF NOT EXISTS 'nft_offer'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`ALTER TABLE "nft_offers" DROP CONSTRAINT "FK_nft_offers_buyer"`);
    await queryRunner.query(`ALTER TABLE "nft_offers" DROP CONSTRAINT "FK_nft_offers_listing"`);
    await queryRunner.query(`ALTER TABLE "nft_listings" DROP CONSTRAINT "FK_nft_listings_buyer"`);
    await queryRunner.query(`ALTER TABLE "nft_listings" DROP CONSTRAINT "FK_nft_listings_seller"`);
    await queryRunner.query(`ALTER TABLE "nft_listings" DROP CONSTRAINT "FK_nft_listings_nft_card"`);
    await queryRunner.query(`ALTER TABLE "nft_player_cards" DROP CONSTRAINT "FK_nft_player_cards_metadata"`);
    await queryRunner.query(`ALTER TABLE "nft_player_cards" DROP CONSTRAINT "FK_nft_player_cards_owner"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "nft_offers"`);
    await queryRunner.query(`DROP TABLE "nft_listings"`);
    await queryRunner.query(`DROP TABLE "nft_player_cards"`);

    // Note: We don't remove enum values as PostgreSQL doesn't support removing enum values
  }
}
