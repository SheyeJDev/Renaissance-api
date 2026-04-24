import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { StakingService } from './staking.service';

@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Post('stake')
  stake(@Body() body: { playerId: string; amount: number; stellarTxHash?: string }) {
    return this.stakingService.stake(body.playerId, body.amount, body.stellarTxHash);
  }

  @Post(':stakeId/unstake')
  unstake(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.unstake(body.playerId, stakeId);
  }

  @Post(':stakeId/claim')
  claim(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.claimRewards(body.playerId, stakeId);
  }

  @Post(':stakeId/compound')
  compound(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.compoundRewards(body.playerId, stakeId);
  }

  @Get(':playerId')
  getStakes(@Param('playerId') playerId: string) {
    return this.stakingService.getPlayerStakes(playerId);
  }
}