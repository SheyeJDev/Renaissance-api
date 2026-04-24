import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SolvencyService } from './solvency.service';

@Injectable()
export class SolvencyProofService {
  private readonly logger = new Logger(SolvencyProofService.name);

  constructor(private readonly solvencyService: SolvencyService) {}

  /**
   * Generate a proof of reserves at 2 AM every day.
   * Runs independently of the metrics check so failures are isolated.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDailyProof(): Promise<void> {
    this.logger.log('Starting scheduled solvency proof generation...');
    try {
      const proof = await this.solvencyService.generateProofOfReserves(true);
      this.logger.log(`Proof generated successfully: id=${proof.id} root=${proof.merkleRoot}`);
    } catch (error) {
      this.logger.error(`Proof generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Archive proofs older than 90 days every Sunday at 3 AM.
   */
  @Cron('0 3 * * 0')
  async archiveOldProofs(): Promise<void> {
    this.logger.log('Archiving solvency proofs older than 90 days...');
    try {
      const archived = await this.solvencyService.archiveOldProofs(90);
      this.logger.log(`Archived ${archived} proof(s)`);
    } catch (error) {
      this.logger.error(`Proof archival failed: ${(error as Error).message}`);
    }
  }
}
