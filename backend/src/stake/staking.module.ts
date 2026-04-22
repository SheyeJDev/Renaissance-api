import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StakingService } from './staking.service';
import { StakingController } from './staking.controller';
import { WalletModule } from '../wallet/wallet.module';
import { Stake } from './entities/stake.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Stake]), ScheduleModule.forRoot(), WalletModule],
  providers: [StakingService],
  controllers: [StakingController],
})
export class StakingModule {}