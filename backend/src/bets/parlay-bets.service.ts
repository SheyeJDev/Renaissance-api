import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ParlayBet, ParlayStatus } from './entities/parlay-bet.entity';
import { ParlaySelection, SelectionStatus } from './entities/parlay-selection.entity';
import { CreateParlayBetDto } from './dto/create-parlay-bet.dto';
import { WalletService } from '../wallet/services/wallet.service';

@Injectable()
export class ParlayBetsService {
  constructor(
    @InjectRepository(ParlayBet)
    private parlayRepo: Repository<ParlayBet>,
    @InjectRepository(ParlaySelection)
    private selectionRepo: Repository<ParlaySelection>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  async placeParlayBet(userId: string, dto: CreateParlayBetDto): Promise<ParlayBet> {
    if (dto.selections.length < 2) {
      throw new BadRequestException('Parlay requires at least 2 selections');
    }

    const matchIds = dto.selections.map((s) => s.matchId);
    if (new Set(matchIds).size !== matchIds.length) {
      throw new BadRequestException('Duplicate matches in parlay');
    }

    const combinedOdds = dto.selections.reduce((acc, s) => acc * s.odds, 1);
    const potentialPayout = parseFloat((dto.stakeAmount * combinedOdds).toFixed(8));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.walletService.debit(userId, dto.stakeAmount, 'PARLAY_BET');

      const parlay = queryRunner.manager.create(ParlayBet, {
        userId,
        reference: `PARLAY-${uuidv4().slice(0, 8).toUpperCase()}`,
        stakeAmount: dto.stakeAmount,
        combinedOdds: parseFloat(combinedOdds.toFixed(8)),
        potentialPayout,
        status: ParlayStatus.PENDING,
      });
      const savedParlay = await queryRunner.manager.save(parlay);

      const selections = dto.selections.map((s) =>
        queryRunner.manager.create(ParlaySelection, {
          parlayId: savedParlay.id,
          matchId: s.matchId,
          predictedOutcome: s.predictedOutcome,
          odds: s.odds,
          status: SelectionStatus.PENDING,
        }),
      );
      await queryRunner.manager.save(selections);

      await queryRunner.commitTransaction();
      return savedParlay;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Settle a single selection. Automatically settles the parlay when all
   * selections are resolved.
   * - All WON → parlay WON, credit payout
   * - Any LOST → parlay LOST
   * - Any VOID → recalculate odds without voided leg (partial void)
   */
  async settleSelection(
    parlayId: string,
    matchId: string,
    result: SelectionStatus,
  ): Promise<ParlayBet> {
    const parlay = await this.parlayRepo.findOne({ where: { id: parlayId } });
    if (!parlay) throw new NotFoundException('Parlay not found');
    if (parlay.status !== ParlayStatus.PENDING) {
      throw new BadRequestException('Parlay already settled');
    }

    const selection = await this.selectionRepo.findOne({
      where: { parlayId, matchId },
    });
    if (!selection) throw new NotFoundException('Selection not found');

    selection.status = result;
    await this.selectionRepo.save(selection);

    const allSelections = await this.selectionRepo.find({ where: { parlayId } });
    const pending = allSelections.filter((s) => s.status === SelectionStatus.PENDING);

    if (pending.length > 0) return parlay; // not all settled yet

    const hasLost = allSelections.some((s) => s.status === SelectionStatus.LOST);
    const voidCount = allSelections.filter((s) => s.status === SelectionStatus.VOID).length;
    const wonCount = allSelections.filter((s) => s.status === SelectionStatus.WON).length;

    if (hasLost) {
      parlay.status = ParlayStatus.LOST;
    } else if (voidCount > 0 && wonCount === 0) {
      // All voided — full refund
      parlay.status = ParlayStatus.VOID;
      await this.walletService.credit(parlay.userId, parlay.stakeAmount, 'PARLAY_VOID');
    } else if (voidCount > 0) {
      // Partial void: recalculate payout with remaining won legs
      parlay.status = ParlayStatus.PARTIAL_VOID;
      const adjustedOdds = allSelections
        .filter((s) => s.status === SelectionStatus.WON)
        .reduce((acc, s) => acc * s.odds, 1);
      const adjustedPayout = parseFloat((parlay.stakeAmount * adjustedOdds).toFixed(8));
      parlay.potentialPayout = adjustedPayout;
      await this.walletService.credit(parlay.userId, adjustedPayout, 'PARLAY_WIN');
    } else {
      // All won
      parlay.status = ParlayStatus.WON;
      await this.walletService.credit(parlay.userId, parlay.potentialPayout, 'PARLAY_WIN');
    }

    parlay.settledAt = new Date();
    return this.parlayRepo.save(parlay);
  }

  async getUserParlays(userId: string): Promise<ParlayBet[]> {
    return this.parlayRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getParlayWithSelections(parlayId: string): Promise<{ parlay: ParlayBet; selections: ParlaySelection[] }> {
    const parlay = await this.parlayRepo.findOne({ where: { id: parlayId } });
    if (!parlay) throw new NotFoundException('Parlay not found');
    const selections = await this.selectionRepo.find({ where: { parlayId } });
    return { parlay, selections };
  }
}
