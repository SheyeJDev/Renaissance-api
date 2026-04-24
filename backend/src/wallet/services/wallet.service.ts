import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { WalletConnection } from '../entities/wallet-connection.entity';
import {
  BalanceTransaction,
  TransactionType,
  TransactionSource,
} from '../entities/balance-transaction.entity';
import { WalletRollbackService, WalletOperation } from './wallet-rollback.service';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletConnection)
    private walletRepo: Repository<WalletConnection>,
    @InjectRepository(BalanceTransaction)
    private balanceTxRepo: Repository<BalanceTransaction>,
    private walletRollbackService: WalletRollbackService,
  ) {}

  async getBalance(
    userId: string,
  ): Promise<{ available: number; locked: number }> {
    const result = await this.balanceTxRepo.find({ where: { userId } });
    const available = result
      .filter((r) => r.type === TransactionType.CREDIT)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const locked = result
      .filter((r) => r.type === TransactionType.DEBIT)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    return { available, locked };
  }

  async debit(userId: string, amount: number, type: string, metadata?: any): Promise<void> {
    // Check balance before debiting
    const balance = await this.getBalance(userId);
    if (balance.available < amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance.available}, Required: ${amount}`,
      );
    }

    await this.balanceTxRepo.save({
      userId,
      amount,
      type: TransactionType.DEBIT,
      source: type as TransactionSource,
      metadata,
    });
  }

  async credit(userId: string, amount: number, type: string, metadata?: any): Promise<void> {
    await this.balanceTxRepo.save({
      userId,
      amount,
      type: TransactionType.CREDIT,
      source: type as TransactionSource,
      metadata,
    });
  }

  /**
   * Execute multiple wallet operations atomically with automatic rollback on failure
   */
  async executeAtomicOperations(
    operations: WalletOperation[],
  ): Promise<{ success: boolean; transactionIds: string[]; error?: string }> {
    return await this.walletRollbackService.executeAtomicOperations(operations);
  }

  /**
   * Safe debit with automatic rollback capability
   */
  async safeDebit(
    userId: string,
    amount: number,
    source: TransactionSource,
    referenceId?: string,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const result = await this.executeAtomicOperations([
        {
          userId,
          amount,
          type: 'debit',
          source,
          referenceId,
        },
      ]);

      return {
        success: result.success,
        transactionId: result.transactionIds[0],
        error: result.error,
      };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }

  /**
   * Safe credit operation
   */
  async safeCredit(
    userId: string,
    amount: number,
    source: TransactionSource,
    referenceId?: string,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const result = await this.executeAtomicOperations([
        {
          userId,
          amount,
          type: 'credit',
          source,
          referenceId,
        },
      ]);

      return {
        success: result.success,
        transactionId: result.transactionIds[0],
        error: result.error,
      };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }

  /**
   * Transfer funds between users atomically
   */
  async transferFunds(
    fromUserId: string,
    toUserId: string,
    amount: number,
    source: TransactionSource,
    referenceId?: string,
  ): Promise<{ success: boolean; transactionIds?: string[]; error?: string }> {
    const operations: WalletOperation[] = [
      {
        userId: fromUserId,
        amount,
        type: 'debit',
        source,
        referenceId: `${referenceId}-debit`,
      },
      {
        userId: toUserId,
        amount,
        type: 'credit',
        source,
        referenceId: `${referenceId}-credit`,
      },
    ];

    return await this.executeAtomicOperations(operations);
  }

  async updateUserBalanceWithQueryRunner(
    userId: string,
    amount: number,
    type: string,
    queryRunner: QueryRunner,
    referenceId?: string,
    metadata?: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // For debit operations, check balance within transaction
      if (type === 'debit') {
        const balance = await this.getBalanceWithinQueryRunner(userId, queryRunner);
        if (balance.available < amount) {
          return {
            success: false,
            error: `Insufficient balance. Available: ${balance.available}, Required: ${amount}`,
          };
        }
      }

      await this.balanceTxRepo.save({
        userId,
        amount,
        type:
          type === 'credit' ? TransactionType.CREDIT : TransactionType.DEBIT,
        source: type as TransactionSource,
        referenceId,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }

  /**
   * Get balance within a query runner context (for transaction safety)
   */
  private async getBalanceWithinQueryRunner(
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<{ available: number; locked: number }> {
    const transactions = await queryRunner.manager.find(BalanceTransaction, {
      where: { userId },
    });

    const available = transactions
      .filter((r) => r.type === TransactionType.CREDIT)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const locked = transactions
      .filter((r) => r.type === TransactionType.DEBIT)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    return { available, locked };
  }
}
