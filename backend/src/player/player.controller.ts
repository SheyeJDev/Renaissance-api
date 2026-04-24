import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { PlayerService } from './player.service';
import { Player } from './entities/player.entity';

@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  create(@Body() dto: Partial<Player>) {
    return this.playerService.create(dto);
  }

  @Get('search')
  search(@Query('name') name: string) {
    return this.playerService.search(name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playerService.findById(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.playerService.getStats(id);
  }

  @Patch(':id/metadata')
  updateMetadata(@Param('id') id: string, @Body() metadata: Record<string, any>) {
    return this.playerService.updateMetadata(id, metadata);
  }
}