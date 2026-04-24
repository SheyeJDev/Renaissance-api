import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { WalletConnection } from '../entities/wallet-connection.entity';
<<<<<<< HEAD
import { BalanceTransaction, TransactionType, TransactionSource } from '../entities/balance-transaction.entity';
import { TransactionType, TransactionType } from 'src/transactions/entities/transaction.entity';
=======
import {
  BalanceTransaction,
  TransactionType,
  TransactionSource,
} from '../entities/balance-transaction.entity';
>>>>>>> 58556d1a5611040fb010b7fe36c60654d5881606

@Injectable()
export class WalletService {
  updateUserBalanceWithQueryRunner(queryRunner: QueryRunner, userId: string, arg2: number, BET_WINNING: TransactionType, id: string, p0: { spinPayout: number; sessionId: string; rewardChannel: "XLM" | "NFT"; }, isWithdrawable: boolean, BET_PLACEMENT: TransactionType, undefined: undefined, arg5: { spinStake: number; sessionId: string; }) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @InjectRepository(WalletConnection)
    private walletRepo: Repository<WalletConnection>,
    @InjectRepository(BalanceTransaction)
    private balanceTxRepo: Repository<BalanceTransaction>,
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

  async debit(userId: string, amount: number, type: string): Promise<void> {
    await this.balanceTxRepo.save({
      userId,
      amount,
      type: TransactionType.DEBIT,
      source: type as TransactionSource,
    });
  }

  async credit(userId: string, amount: number, type: string): Promise<void> {
    await this.balanceTxRepo.save({
      userId,
      amount,
      type: TransactionType.CREDIT,
      source: type as TransactionSource,
    });
  }
<<<<<<< HEAD
}
=======

  async updateUserBalanceWithQueryRunner(
    userId: string,
    amount: number,
    type: string,
    queryRunner: any,
    referenceId?: string,
    metadata?: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
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
}
>>>>>>> 58556d1a5611040fb010b7fe36c60654d5881606
