# Daily Data Snapshots & Point-in-Time Reconstruction

## Overview

This document outlines the implementation of a daily data snapshot system for critical betting data, balances, and stakes with point-in-time reconstruction capabilities and cold storage archival.

## Features

### 1. Daily Snapshot Generation
- Automated daily snapshots of critical data at configurable times (default: 00:00 UTC)
- Captures state of:
  - Bets (active, settled, pending)
  - User balances (available, locked, pending withdrawal)
  - Stake positions (active stakes, rewards, penalties)
  - Wallet holdings (cash, tokens, NFTs)
- Snapshot compression and versioning

### 2. Point-in-Time Reconstruction
- Query any historical state within snapshot retention period
- Reconstruct account balances at specific timestamps
- Retrieve historical bet records with original odds/stakes
- Validate historical stake positions and accrued rewards
- Support for audit investigations and dispute resolution

### 3. Storage Architecture
- **Hot Storage**: Last 30 days in primary database
- **Warm Storage**: 31-90 days in secondary database or cache
- **Cold Storage**: 90+ days archived to S3 Glacier with indexing

## Database Schema

### Snapshots Table
```sql
CREATE TABLE data_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date TIMESTAMP NOT NULL,
  snapshot_type ENUM('full', 'incremental') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'completed', 'verified', 'archived') DEFAULT 'pending',
  record_count INT,
  size_bytes BIGINT,
  checksum VARCHAR(64),
  storage_location ENUM('hot', 'warm', 'cold') DEFAULT 'hot',
  s3_key VARCHAR(512),
  retention_until TIMESTAMP,
  INDEX idx_snapshot_date (snapshot_date),
  INDEX idx_status (status)
);
```

### Bet Snapshots Table
```sql
CREATE TABLE bet_snapshots (
  id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id),
  bet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  match_id UUID,
  stake DECIMAL(20,8) NOT NULL,
  odds DECIMAL(10,6) NOT NULL,
  potential_return DECIMAL(20,8),
  status ENUM('pending', 'won', 'lost', 'cancelled', 'settled') NOT NULL,
  created_at TIMESTAMP,
  settled_at TIMESTAMP,
  snapshot_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_snapshot_id_user (snapshot_id, user_id),
  INDEX idx_bet_id (bet_id)
);
```

### Balance Snapshots Table
```sql
CREATE TABLE balance_snapshots (
  id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id),
  user_id UUID NOT NULL,
  available_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
  locked_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
  pending_withdrawal DECIMAL(20,8) NOT NULL DEFAULT 0,
  total_balance DECIMAL(20,8) NOT NULL GENERATED ALWAYS AS 
    (available_balance + locked_balance + pending_withdrawal),
  currency VARCHAR(10) DEFAULT 'USD',
  snapshot_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_snapshot_id_user (snapshot_id, user_id),
  UNIQUE(snapshot_id, user_id)
);
```

### Stake Snapshots Table
```sql
CREATE TABLE stake_snapshots (
  id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id),
  user_id UUID NOT NULL,
  stake_id UUID NOT NULL,
  staked_amount DECIMAL(20,8) NOT NULL,
  token_symbol VARCHAR(20),
  status ENUM('active', 'unstaking', 'completed', 'slashed') NOT NULL,
  accrued_rewards DECIMAL(20,8) NOT NULL DEFAULT 0,
  penalties DECIMAL(20,8) NOT NULL DEFAULT 0,
  started_at TIMESTAMP,
  snapshot_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_snapshot_id_user (snapshot_id, user_id),
  INDEX idx_stake_id (stake_id)
);
```

## Implementation Details

### Snapshot Service Module

#### SnapshotService (Core Logic)
```typescript
@Injectable()
export class SnapshotService {
  constructor(
    @InjectRepository(DataSnapshot) private snapshotRepo: Repository<DataSnapshot>,
    @InjectRepository(BetSnapshot) private betSnapshotRepo: Repository<BetSnapshot>,
    @InjectRepository(BalanceSnapshot) private balanceSnapshotRepo: Repository<BalanceSnapshot>,
    @InjectRepository(StakeSnapshot) private stakeSnapshotRepo: Repository<StakeSnapshot>,
    private betsService: BetsService,
    private walletService: WalletService,
    private stakeService: StakeService,
    private s3Service: S3StorageService,
    private logger: LoggerService,
  ) {}

  // Create daily comprehensive snapshot
  async createDailySnapshot(): Promise<DataSnapshot> {}

  // Create incremental snapshot since last full snapshot
  async createIncrementalSnapshot(): Promise<DataSnapshot> {}

  // Archive old snapshots to cold storage
  async archiveOldSnapshots(daysThreshold: number = 90): Promise<void> {}

  // Retrieve point-in-time balance
  async getBalanceAtTime(
    userId: string,
    timestamp: Date,
  ): Promise<BalanceSnapshot> {}

  // Reconstruct account state at specific time
  async reconstructAccountState(
    userId: string,
    timestamp: Date,
  ): Promise<PointInTimeState> {}

  // List available snapshots for audit period
  async listSnapshotsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<DataSnapshot[]> {}

  // Restore specific bet record from snapshot
  async restoreBetRecord(betId: string, snapshotId: string): Promise<BetSnapshot> {}
}
```

### Scheduled Snapshot Jobs

#### Snapshot Scheduler
```typescript
@Injectable()
export class SnapshotScheduler {
  constructor(private snapshotService: SnapshotService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailySnapshot(): Promise<void> {
    // Execute comprehensive snapshot
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async incrementalSnapshot(): Promise<void> {
    // Capture deltas
  }

  @Cron('0 2 * * 0') // Weekly on Sunday 2 AM
  async archiveSnapshots(): Promise<void> {
    // Move 90+ day snapshots to cold storage
  }
}
```

### Point-in-Time Reconstruction

#### Reconstruction Service
```typescript
@Injectable()
export class PointInTimeService {
  constructor(
    @InjectRepository(BetSnapshot) private betSnapshotRepo: Repository<BetSnapshot>,
    @InjectRepository(BalanceSnapshot) private balanceSnapshotRepo: Repository<BalanceSnapshot>,
    @InjectRepository(StakeSnapshot) private stakeSnapshotRepo: Repository<StakeSnapshot>,
    private s3Service: S3StorageService,
    private logger: LoggerService,
  ) {}

  // Reconstruct full account state at any point
  async getPointInTimeState(
    userId: string,
    timestamp: Date,
  ): Promise<PointInTimeState> {
    const snapshot = await this.findNearestSnapshot(timestamp);
    return {
      timestamp,
      snapshot,
      balances: await this.getBalancesAtTime(userId, timestamp, snapshot),
      activeBets: await this.getActiveBetsAtTime(userId, timestamp, snapshot),
      stakes: await this.getStakesAtTime(userId, timestamp, snapshot),
      reconstructedAt: new Date(),
    };
  }

  // Get exact balance at specific timestamp
  async getBalanceAtTime(userId: string, timestamp: Date): Promise<Decimal> {}

  // Retrieve active bets as of specific date
  async getActiveBetsAtTime(userId: string, timestamp: Date): Promise<Bet[]> {}

  // Get stake positions and rewards at point in time
  async getStakesAtTime(userId: string, timestamp: Date): Promise<Stake[]> {}

  // Validate data integrity at snapshot
  async validateSnapshotIntegrity(snapshotId: string): Promise<boolean> {}

  private async findNearestSnapshot(timestamp: Date): Promise<DataSnapshot> {}
}
```

### S3 Cold Storage Management

#### S3 Archive Service
```typescript
@Injectable()
export class S3ArchiveService {
  constructor(private s3: AWS.S3, private logger: LoggerService) {}

  // Archive snapshot to S3 Glacier
  async archiveSnapshot(
    snapshotId: string,
    data: Buffer,
    metadata: SnapshotMetadata,
  ): Promise<string> {
    const s3Key = this.generateS3Key(snapshotId);
    const params = {
      Bucket: process.env.SNAPSHOT_ARCHIVE_BUCKET,
      Key: s3Key,
      Body: data,
      StorageClass: 'GLACIER',
      Metadata: {
        'snapshot-id': snapshotId,
        'snapshot-date': metadata.snapshotDate.toISOString(),
        'record-count': metadata.recordCount.toString(),
      },
      ServerSideEncryption: 'AES256',
    };
    
    await this.s3.putObject(params).promise();
    return s3Key;
  }

  // Retrieve archived snapshot from S3
  async retrieveArchivedSnapshot(s3Key: string): Promise<Buffer> {
    const params = {
      Bucket: process.env.SNAPSHOT_ARCHIVE_BUCKET,
      Key: s3Key,
    };
    const result = await this.s3.getObject(params).promise();
    return result.Body as Buffer;
  }

  // List archived snapshots with lifecycle management
  async listArchivedSnapshots(prefix: string): Promise<S3Object[]> {}

  // Initiate expedited restore from Glacier
  async restoreFromGlacier(s3Key: string, days: number = 7): Promise<void> {}

  private generateS3Key(snapshotId: string): string {
    const date = new Date();
    return `snapshots/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${snapshotId}.gz`;
  }
}
```

## API Endpoints

### Controller Implementation
```typescript
@Controller('admin/snapshots')
@UseGuards(AuthGuard, AdminGuard)
export class SnapshotController {
  constructor(
    private snapshotService: SnapshotService,
    private pointInTimeService: PointInTimeService,
  ) {}

  // Trigger manual snapshot
  @Post('trigger')
  async triggerSnapshot(): Promise<DataSnapshot> {}

  // Get available snapshots
  @Get('list')
  async listSnapshots(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<DataSnapshot[]> {}

  // Retrieve balance at specific time
  @Get('balance-history/:userId')
  async getBalanceHistory(
    @Param('userId') userId: string,
    @Query('timestamp') timestamp: string,
  ): Promise<BalanceSnapshot> {}

  // Reconstruct account state
  @Get('reconstruct/:userId')
  async reconstructState(
    @Param('userId') userId: string,
    @Query('timestamp') timestamp: string,
  ): Promise<PointInTimeState> {}

  // Validate snapshot integrity
  @Post('validate/:snapshotId')
  async validateSnapshot(@Param('snapshotId') snapshotId: string): Promise<{valid: boolean}> {}

  // Retrieve archived snapshot
  @Post('restore/:snapshotId')
  async restoreArchived(@Param('snapshotId') snapshotId: string): Promise<DataSnapshot> {}
}
```

## Configuration

### Environment Variables
```env
# Snapshot Configuration
SNAPSHOT_ENABLED=true
SNAPSHOT_DAILY_TIME=00:00
SNAPSHOT_RETENTION_DAYS=90
SNAPSHOT_HOT_STORAGE_DAYS=30
SNAPSHOT_WARM_STORAGE_DAYS=60

# S3 Configuration
SNAPSHOT_ARCHIVE_BUCKET=renaissance-snapshots
SNAPSHOT_ARCHIVE_REGION=us-east-1
SNAPSHOT_ARCHIVE_STORAGE_CLASS=GLACIER
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***

# Compression
SNAPSHOT_COMPRESSION_ENABLED=true
SNAPSHOT_COMPRESSION_LEVEL=9
```

## Data Integrity & Verification

### Checksum Validation
- SHA-256 checksums for each snapshot
- Verify integrity on retrieval
- Automatic retry on checksum mismatch
- Corruption detection and alerting

### Backup Strategy
- Replicate snapshots across regions
- Daily backup verification
- Regular restore drills
- Disaster recovery SLA: 4-hour RTO, 1-hour RPO

## Performance Considerations

- Snapshot generation runs in background during off-peak hours
- Incremental snapshots reduce storage and processing overhead
- Compression reduces S3 storage costs by ~70%
- Indexed queries allow sub-second point-in-time lookups
- Pagination for large result sets

## Retention Policies

| Storage Tier | Retention Period | Use Case |
|---|---|---|
| Hot (Primary DB) | 0-30 days | Real-time audits, disputes |
| Warm (Secondary/Cache) | 31-90 days | Historical analysis |
| Cold (S3 Glacier) | 91-2555 days | Compliance, long-term archive |

## Compliance & Audit

- Immutable snapshots for regulatory compliance
- Complete audit trail of snapshot operations
- Tamper detection and alerts
- Integration with centralized audit logging
- GDPR/data deletion support with secure erasure

## Testing Strategy

1. Unit tests for snapshot generation logic
2. Integration tests for database persistence
3. S3 integration tests for archival/retrieval
4. Point-in-time reconstruction validation tests
5. Load tests for daily snapshot performance
6. Disaster recovery tests with restoration from cold storage

## Monitoring & Alerts

- Daily snapshot completion status
- Snapshot size and processing time tracking
- S3 archival success rate
- Cold storage retrieval latency
- Data integrity check failures
- Storage cost monitoring

## Future Enhancements

- Real-time streaming snapshots for critical operations
- ML-based anomaly detection in snapshot deltas
- GraphQL API for point-in-time queries
- Snapshot comparison and diff generation
- Blockchain commitment of snapshot hashes for immutability
