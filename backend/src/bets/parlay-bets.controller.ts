import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ParlayBetsService } from './parlay-bets.service';
import { CreateParlayBetDto } from './dto/create-parlay-bet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('parlay-bets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bets/parlay')
export class ParlayBetsController {
  constructor(private readonly parlayBetsService: ParlayBetsService) {}

  @Post()
  @ApiOperation({ summary: 'Place a parlay/multi-bet' })
  place(@CurrentUser() user: any, @Body() dto: CreateParlayBetDto) {
    return this.parlayBetsService.placeParlayBet(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user parlay bets' })
  list(@CurrentUser() user: any) {
    return this.parlayBetsService.getUserParlays(user.id);
  }

  @Get(':parlayId')
  @ApiOperation({ summary: 'Get parlay with selections' })
  get(@Param('parlayId') parlayId: string) {
    return this.parlayBetsService.getParlayWithSelections(parlayId);
  }
}
