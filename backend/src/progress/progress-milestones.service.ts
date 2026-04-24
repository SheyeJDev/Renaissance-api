import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSpinStats } from '../spin-game/entities/user-spin-stats.entity';
import { Leaderboard } from '../leaderboard/entities/leaderboard.entity';

export interface Milestone {
  key: string;
  label: string;
  target: number;
  current: number;
  achieved: boolean;
}

export interface ProgressSnapshot {
  userId: string;
  milestones: Milestone[];
  achievedCount: number;
  totalCount: number;
}

@Injectable()
export class ProgressMilestonesService {
  constructor(
    @InjectRepository(UserSpinStats)
    private readonly spinStatsRepo: Repository<UserSpinStats>,
    @InjectRepository(Leaderboard)
    private readonly leaderboardRepo: Repository<Leaderboard>,
  ) {}

  async trackProgress(userId: string): Promise<ProgressSnapshot> {
    const [spinStats, leaderboard] = await Promise.all([
      this.spinStatsRepo.findOne({ where: { userId } }),
      this.leaderboardRepo.findOne({ where: { userId } }),
    ]);

    const milestones = this.buildMilestones(spinStats, leaderboard);

    return {
      userId,
      milestones,
      achievedCount: milestones.filter((m) => m.achieved).length,
      totalCount: milestones.length,
    };
  }

  async getMilestones(userId: string): Promise<Milestone[]> {
    const snapshot = await this.trackProgress(userId);
    return snapshot.milestones;
  }

  private buildMilestones(
    spinStats: UserSpinStats | null,
    leaderboard: Leaderboard | null,
  ): Milestone[] {
    const totalSpins = spinStats?.totalSpins ?? 0;
    const totalBets = leaderboard?.totalBets ?? 0;
    const betsWon = leaderboard?.betsWon ?? 0;
    const totalWinnings = leaderboard?.totalWinnings ?? 0;

    return [
      { key: 'first_spin', label: 'First Spin', target: 1, current: totalSpins, achieved: totalSpins >= 1 },
      { key: 'spin_10', label: '10 Spins', target: 10, current: totalSpins, achieved: totalSpins >= 10 },
      { key: 'spin_100', label: '100 Spins', target: 100, current: totalSpins, achieved: totalSpins >= 100 },
      { key: 'first_bet', label: 'First Bet', target: 1, current: totalBets, achieved: totalBets >= 1 },
      { key: 'bet_10', label: '10 Bets Placed', target: 10, current: totalBets, achieved: totalBets >= 10 },
      { key: 'win_5', label: '5 Bets Won', target: 5, current: betsWon, achieved: betsWon >= 5 },
      { key: 'win_50', label: '50 Bets Won', target: 50, current: betsWon, achieved: betsWon >= 50 },
      { key: 'earnings_1000', label: '1,000 Earnings', target: 1000, current: totalWinnings, achieved: totalWinnings >= 1000 },
    ];
  }
}
