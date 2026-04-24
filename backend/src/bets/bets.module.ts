import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { ParlayBetsService } from './parlay-bets.service';
import { ParlayBetsController } from './parlay-bets.controller';
import { PrizeVestingService } from './prize-vesting.service';
import { PrizeVestingController } from './prize-vesting.controller';
import { Bet } from './entities/bet.entity';
import { ParlayBet } from './entities/parlay-bet.entity';
import { ParlaySelection } from './entities/parlay-selection.entity';
import { PrizeVesting } from './entities/prize-vesting.entity';
import { Match } from '../matches/entities/match.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WalletModule } from '../wallet/wallet.module';
import { FreeBetVouchersModule } from '../free-bet-vouchers/free-bet-vouchers.module';
import { SpinModule } from '../spin/spin.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Bet, Match, ParlayBet, ParlaySelection, PrizeVesting]),
    forwardRef(() => LeaderboardModule),
    WalletModule,
    FreeBetVouchersModule,
    SpinModule,
    RateLimitModule,
  ],
  controllers: [BetsController, ParlayBetsController, PrizeVestingController],
  providers: [BetsService, ParlayBetsService, PrizeVestingService],
  exports: [BetsService, ParlayBetsService, PrizeVestingService],
})
export class BetsModule {}
