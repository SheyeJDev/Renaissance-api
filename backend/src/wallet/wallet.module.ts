import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletConnection } from './entities/wallet-connection.entity';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { WalletService } from './services/wallet.service';
import { WalletConnectionService } from './services/wallet-connection.service';
import { WalletConnectionController } from './controllers/wallet-connection.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WalletConnection, BalanceTransaction])],
  providers: [WalletService, WalletConnectionService],
  controllers: [WalletConnectionController],
  exports: [WalletService, WalletConnectionService],
})
export class WalletModule {}
