import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { TreasuryService, DistributionRecipient } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Post('distributions')
  create(@Body() body: { recipients: DistributionRecipient[] }) {
    return this.treasuryService.createDistribution(body.recipients);
  }

  @Post('distributions/:id/process')
  process(@Param('id') id: string) {
    return this.treasuryService.processDistribution(id);
  }

  @Get('distributions')
  list() {
    return this.treasuryService.listDistributions();
  }

  @Get('distributions/:id')
  findOne(@Param('id') id: string) {
    return this.treasuryService.getDistribution(id);
  }
}