import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrizeVesting, VestingStatus } from './entities/prize-vesting.entity';
import { WalletService } from '../wallet/services/wallet.service';

export const VESTING_THRESHOLD = 10_000; // XLM
export const VESTING_DAYS = 30;
export const EARLY_CLAIM_PENALTY = 0.1; // 10%

@Injectable()
export class PrizeVestingService {
  constructor(
    @InjectRepository(PrizeVesting)
    private vestingRepo: Repository<PrizeVesting>,
    private walletService: WalletService,
  ) {}

  /**
   * Create a vesting schedule for a large payout.
   * Called automatically when a bet/parlay payout exceeds VESTING_THRESHOLD.
   */
  async createVesting(
    userId: string,
    sourceReference: string,
    totalAmount: number,
  ): Promise<PrizeVesting> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + VESTING_DAYS);

    const dailyRelease = parseFloat((totalAmount / VESTING_DAYS).toFixed(8));

    const vesting = this.vestingRepo.create({
      userId,
      sourceReference,
      totalAmount,
      releasedAmount: 0,
      dailyRelease,
      status: VestingStatus.ACTIVE,
      vestingStartDate: now,
      vestingEndDate: endDate,
    });

    return this.vestingRepo.save(vesting);
  }

  /**
   * Release today's vested amount for a specific vesting schedule.
   * Idempotent — won't release twice on the same day.
   */
  async releaseDailyVesting(vestingId: string): Promise<PrizeVesting> {
    const vesting = await this.vestingRepo.findOne({ where: { id: vestingId } });
    if (!vesting) throw new NotFoundException('Vesting not found');
    if (vesting.status !== VestingStatus.ACTIVE) {
      throw new BadRequestException('Vesting is not active');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (vesting.lastReleaseDate) {
      const lastRelease = new Date(vesting.lastReleaseDate);
      lastRelease.setHours(0, 0, 0, 0);
      if (lastRelease >= today) {
        throw new BadRequestException('Already released today');
      }
    }

    const remaining = parseFloat((vesting.totalAmount - vesting.releasedAmount).toFixed(8));
    const toRelease = Math.min(vesting.dailyRelease, remaining);

    await this.walletService.credit(vesting.userId, toRelease, 'VESTING_RELEASE');

    vesting.releasedAmount = parseFloat((vesting.releasedAmount + toRelease).toFixed(8));
    vesting.lastReleaseDate = new Date();

    if (vesting.releasedAmount >= vesting.totalAmount) {
      vesting.status = VestingStatus.COMPLETED;
    }

    return this.vestingRepo.save(vesting);
  }

  /**
   * Early claim: release all remaining vested amount minus 10% penalty.
   */
  async earlyClaimVesting(userId: string, vestingId: string): Promise<PrizeVesting> {
    const vesting = await this.vestingRepo.findOne({
      where: { id: vestingId, userId },
    });
    if (!vesting) throw new NotFoundException('Vesting not found');
    if (vesting.status !== VestingStatus.ACTIVE) {
      throw new BadRequestException('Vesting is not active');
    }

    const remaining = parseFloat((vesting.totalAmount - vesting.releasedAmount).toFixed(8));
    const penalty = parseFloat((remaining * EARLY_CLAIM_PENALTY).toFixed(8));
    const payout = parseFloat((remaining - penalty).toFixed(8));

    await this.walletService.credit(vesting.userId, payout, 'VESTING_EARLY_CLAIM');

    vesting.releasedAmount = vesting.totalAmount;
    vesting.status = VestingStatus.EARLY_CLAIMED;
    vesting.metadata = { earlyClaimPenalty: penalty, earlyClaimPayout: payout };

    return this.vestingRepo.save(vesting);
  }

  /** Cron: auto-release daily vesting for all active schedules */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailyReleases(): Promise<void> {
    const activeVestings = await this.vestingRepo.find({
      where: { status: VestingStatus.ACTIVE },
    });

    for (const vesting of activeVestings) {
      try {
        await this.releaseDailyVesting(vesting.id);
      } catch {
        // Skip already-released or errored vestings
      }
    }
  }

  async getUserVestings(userId: string): Promise<PrizeVesting[]> {
    return this.vestingRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
