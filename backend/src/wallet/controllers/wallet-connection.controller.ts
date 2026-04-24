import {
  Controller,
  Post,
  Delete,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletConnectionService } from '../services/wallet-connection.service';
import { WalletType } from '../entities/wallet-connection.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

class ConnectWalletDto {
  publicKey: string;
  walletType?: WalletType;
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet/connections')
export class WalletConnectionController {
  constructor(private readonly walletConnectionService: WalletConnectionService) {}

  @Post()
  @ApiOperation({ summary: 'Connect a Stellar wallet address' })
  connect(@CurrentUser() user: any, @Body() dto: ConnectWalletDto) {
    return this.walletConnectionService.connectWallet(
      user.id,
      dto.publicKey,
      dto.walletType,
    );
  }

  @Delete(':walletId')
  @ApiOperation({ summary: 'Disconnect a wallet' })
  disconnect(@CurrentUser() user: any, @Param('walletId') walletId: string) {
    return this.walletConnectionService.disconnectWallet(user.id, walletId);
  }

  @Patch(':walletId/default')
  @ApiOperation({ summary: 'Set a wallet as default' })
  setDefault(@CurrentUser() user: any, @Param('walletId') walletId: string) {
    return this.walletConnectionService.setDefaultWallet(user.id, walletId);
  }

  @Get()
  @ApiOperation({ summary: 'List all connected wallets' })
  list(@CurrentUser() user: any) {
    return this.walletConnectionService.getUserWallets(user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default wallet' })
  getDefault(@CurrentUser() user: any) {
    return this.walletConnectionService.getDefaultWallet(user.id);
  }
}
