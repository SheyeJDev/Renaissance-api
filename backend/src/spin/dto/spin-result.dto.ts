import { ApiProperty } from '@nestjs/swagger';
import { SpinOutcome } from '../entities/spin.entity';

export class SpinResultDto {
  @ApiProperty({
    description: 'Unique spin identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Outcome of the spin',
    enum: SpinOutcome,
    example: SpinOutcome.HIGH_WIN,
  })
  outcome!: SpinOutcome;

  @ApiProperty({
    description: 'Amount won from the spin',
    example: 50.0,
    type: Number,
  })
  payoutAmount!: number;

  @ApiProperty({
    description: 'Amount staked on the spin',
    example: 10.0,
    type: Number,
  })
  stakeAmount!: number;

  @ApiProperty({
    description: 'Net result (payout minus stake)',
    example: 40.0,
    type: Number,
  })
  netResult!: number;

  @ApiProperty({
    description: 'When the spin occurred',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp!: Date;
}
