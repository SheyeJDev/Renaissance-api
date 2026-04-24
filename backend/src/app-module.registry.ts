/**
 * Central registry of feature modules that must be imported in AppModule.
 * Add the corresponding import statements to app.module.ts as each module
 * is stabilised and ready for production.
 *
 * Pending modules (tracked by issue #324):
 *   - SpinGameModule     → from './spin-game/spin-game.module'
 *   - WalletModule       → from './wallet/wallet.module'
 *   - LeaderboardModule  → from './leaderboard/leaderboard.module'
 *   - GamificationModule → from './gamification/gamification.module'
 */

import { Type } from '@nestjs/common';
import { SpinGameModule } from './spin-game/spin-game.module';
import { WalletModule } from './wallet/wallet.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { GamificationModule } from './gamification/gamification.module';

export const FEATURE_MODULES: Type[] = [
  SpinGameModule,
  WalletModule,
  LeaderboardModule,
  GamificationModule,
];
