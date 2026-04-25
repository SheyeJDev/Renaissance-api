import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletConnection } from './entities/wallet-connection.entity';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { WalletService } from './services/wallet.service';
import { WalletConnectionService } from './services/wallet-connection.service';
import { WalletRollbackService } from './services/wallet-rollback.service';
import { WalletConnectionController } from './controllers/wallet-connection.controller';
import { WalletAdminController } from './controllers/wallet-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WalletConnection, BalanceTransaction])],
  providers: [WalletService, WalletConnectionService, WalletRollbackService],
  controllers: [WalletConnectionController, WalletAdminController],
  exports: [WalletService, WalletConnectionService, WalletRollbackService],
})
export class WalletModule {}
