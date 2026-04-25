import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository, DataSource } from 'typeorm';
import { WalletService } from './wallet.service';
import { BalanceTransaction, TransactionType, TransactionSource } from '../entities/balance-transaction.entity';

export interface WalletOperation {
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  source: TransactionSource;
  referenceId?: string;
  metadata?: any;
}

export interface RollbackOperation {
  transactionId: string;
  compensatingAction: WalletOperation;
}

@Injectable()
export class WalletRollbackService {
  constructor(
    @InjectRepository(BalanceTransaction)
    private balanceTxRepo: Repository<BalanceTransaction>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  /**
   * Execute multiple wallet operations atomically
   * If any operation fails, all previous operations are rolled back
   */
  async executeAtomicOperations(
    operations: WalletOperation[],
  ): Promise<{ success: boolean; transactionIds: string[]; error?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const transactionIds: string[] = [];

    try {
      for (const operation of operations) {
        // Check balance for debit operations
        if (operation.type === 'debit') {
          const balance = await this.getBalanceWithinTransaction(
            operation.userId,
            queryRunner,
          );
          if (balance.available < operation.amount) {
            throw new BadRequestException(
              `Insufficient balance for user ${operation.userId}. Available: ${balance.available}, Required: ${operation.amount}`,
            );
          }
        }

        // Execute the operation
        const transaction = await this.createTransactionWithinRunner(
          operation,
          queryRunner,
        );
        transactionIds.push(transaction.id);
      }

      await queryRunner.commitTransaction();
      return { success: true, transactionIds };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return { success: false, transactionIds: [], error: error?.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rollback specific transactions by creating compensating entries
   */
  async rollbackTransactions(
    transactionIds: string[],
  ): Promise<{ success: boolean; compensatingTransactionIds: string[]; error?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const compensatingTransactionIds: string[] = [];

    try {
      for (const transactionId of transactionIds) {
        const originalTransaction = await queryRunner.manager.findOne(
          BalanceTransaction,
          { where: { id: transactionId } },
        );

        if (!originalTransaction) {
          throw new BadRequestException(`Transaction ${transactionId} not found`);
        }

        // Create compensating transaction
        const compensatingOperation: WalletOperation = {
          userId: originalTransaction.userId,
          amount: originalTransaction.amount,
          type: originalTransaction.type === TransactionType.CREDIT ? 'debit' : 'credit',
          source: TransactionSource.WITHDRAWAL, // Use withdrawal as compensating source
          referenceId: `rollback-${transactionId}`,
          metadata: {
            originalTransactionId: transactionId,
            rollbackReason: 'compensating_transaction',
          },
        };

        const compensatingTransaction = await this.createTransactionWithinRunner(
          compensatingOperation,
          queryRunner,
        );
        compensatingTransactionIds.push(compensatingTransaction.id);
      }

      await queryRunner.commitTransaction();
      return { success: true, compensatingTransactionIds };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return { success: false, compensatingTransactionIds: [], error: error?.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Manual balance adjustment by admin with audit trail
   */
  async adminBalanceAdjustment(
    adminUserId: string,
    targetUserId: string,
    amount: number,
    adjustmentType: 'credit' | 'debit',
    reason: string,
    referenceId?: string,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // For debit adjustments, check balance
      if (adjustmentType === 'debit') {
        const balance = await this.getBalanceWithinTransaction(
          targetUserId,
          queryRunner,
        );
        if (balance.available < amount) {
          throw new BadRequestException(
            `Cannot debit ${amount} from user ${targetUserId}. Available balance: ${balance.available}`,
          );
        }
      }

      const operation: WalletOperation = {
        userId: targetUserId,
        amount: Math.abs(amount),
        type: adjustmentType,
        source: TransactionSource.WITHDRAWAL, // Use withdrawal for admin adjustments
        referenceId: referenceId || `admin-adjustment-${Date.now()}`,
        metadata: {
          adminUserId,
          adjustmentReason: reason,
          adminAdjustment: true,
          timestamp: new Date().toISOString(),
        },
      };

      const transaction = await this.createTransactionWithinRunner(
        operation,
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return { success: true, transactionId: transaction.id };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      return { success: false, error: error?.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get balance within a transaction context
   */
  private async getBalanceWithinTransaction(
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

  /**
   * Create a transaction within a query runner context
   */
  private async createTransactionWithinRunner(
    operation: WalletOperation,
    queryRunner: QueryRunner,
  ): Promise<BalanceTransaction> {
    const balance = await this.getBalanceWithinTransaction(
      operation.userId,
      queryRunner,
    );

    const previousBalance = balance.available - balance.locked;
    const newBalance =
      operation.type === 'credit'
        ? previousBalance + operation.amount
        : previousBalance - operation.amount;

    const transaction = queryRunner.manager.create(BalanceTransaction, {
      userId: operation.userId,
      amount: operation.amount,
      type: operation.type === 'credit' ? TransactionType.CREDIT : TransactionType.DEBIT,
      source: operation.source,
      referenceId: operation.referenceId,
      previousBalance,
      newBalance,
      metadata: operation.metadata,
    });

    return await queryRunner.manager.save(transaction);
  }

  /**
   * Get transaction history with rollback information
   */
  async getTransactionHistory(
    userId: string,
    includeRollbacks: boolean = false,
  ): Promise<BalanceTransaction[]> {
    const where: any = { userId };
    if (!includeRollbacks) {
      where.metadata = null; // Exclude rollback transactions
    }

    return await this.balanceTxRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}