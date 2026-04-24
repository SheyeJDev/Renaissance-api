import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMetadataToBalanceTransactions1776000000000 implements MigrationInterface {
  name = 'AddMetadataToBalanceTransactions1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'balance_transactions',
      new TableColumn({
        name: 'metadata',
        type: 'json',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('balance_transactions', 'metadata');
  }
}