import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletRollbackService } from '../services/wallet-rollback.service';
import { WalletService } from '../services/wallet.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TransactionSource } from '../entities/balance-transaction.entity';

class AdminBalanceAdjustmentDto {
  targetUserId: string;
  amount: number;
  adjustmentType: 'credit' | 'debit';
  reason: string;
  referenceId?: string;
}

class RollbackTransactionsDto {
  transactionIds: string[];
}

@ApiTags('wallet-admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('wallet/admin')
export class WalletAdminController {
  constructor(
    private readonly walletRollbackService: WalletRollbackService,
    private readonly walletService: WalletService,
  ) {}

  @Post('balance-adjustment')
  @ApiOperation({ summary: 'Admin manual balance adjustment with audit trail' })
  async adjustBalance(
    @CurrentUser() admin: any,
    @Body() dto: AdminBalanceAdjustmentDto,
  ) {
    return await this.walletRollbackService.adminBalanceAdjustment(
      admin.id,
      dto.targetUserId,
      dto.amount,
      dto.adjustmentType,
      dto.reason,
      dto.referenceId,
    );
  }

  @Post('rollback')
  @ApiOperation({ summary: 'Rollback specific transactions' })
  async rollbackTransactions(@Body() dto: RollbackTransactionsDto) {
    return await this.walletRollbackService.rollbackTransactions(dto.transactionIds);
  }

  @Get('transactions/:userId')
  @ApiOperation({ summary: 'Get user transaction history' })
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query('includeRollbacks') includeRollbacks?: boolean,
  ) {
    return await this.walletRollbackService.getTransactionHistory(
      userId,
      includeRollbacks === true,
    );
  }

  @Get('balance/:userId')
  @ApiOperation({ summary: 'Get user balance details' })
  async getUserBalance(@Param('userId') userId: string) {
    return await this.walletService.getBalance(userId);
  }
}