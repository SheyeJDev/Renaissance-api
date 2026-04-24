import { IsArray, IsNumber, IsPositive, ValidateNested, IsEnum, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MatchOutcome } from '../../common/enums/match.enums';

export class ParlaySelectionDto {
  @ApiProperty()
  @IsUUID()
  matchId: string;

  @ApiProperty({ enum: MatchOutcome })
  @IsEnum(MatchOutcome)
  predictedOutcome: MatchOutcome;

  @ApiProperty()
  @IsNumber()
  @Min(1.01)
  odds: number;
}

export class CreateParlayBetDto {
  @ApiProperty({ type: [ParlaySelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParlaySelectionDto)
  selections: ParlaySelectionDto[];

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  stakeAmount: number;
}
