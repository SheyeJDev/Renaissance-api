import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { WalletModule } from '../wallet/wallet.module';
import { TreasuryDistribution, TreasuryDistributionItem } from './entities/treasury.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TreasuryDistribution, TreasuryDistributionItem]), WalletModule],
  providers: [TreasuryService],
  controllers: [TreasuryController],
})
export class TreasuryModule {}