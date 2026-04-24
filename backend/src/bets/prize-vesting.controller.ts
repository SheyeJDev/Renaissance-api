import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrizeVestingService } from './prize-vesting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('prize-vesting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bets/vesting')
export class PrizeVestingController {
  constructor(private readonly prizeVestingService: PrizeVestingService) {}

  @Get()
  @ApiOperation({ summary: 'Get user vesting schedules' })
  list(@CurrentUser() user: any) {
    return this.prizeVestingService.getUserVestings(user.id);
  }

  @Post(':vestingId/release')
  @ApiOperation({ summary: 'Trigger daily vesting release' })
  release(@Param('vestingId') vestingId: string) {
    return this.prizeVestingService.releaseDailyVesting(vestingId);
  }

  @Post(':vestingId/early-claim')
  @ApiOperation({ summary: 'Early claim with 10% penalty' })
  earlyClaim(@CurrentUser() user: any, @Param('vestingId') vestingId: string) {
    return this.prizeVestingService.earlyClaimVesting(user.id, vestingId);
  }
}
