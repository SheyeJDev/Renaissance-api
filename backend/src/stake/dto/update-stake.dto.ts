import { PartialType } from '@nestjs/swagger';
import { CreateStakeDto } from './create-stake.dto';

export class UpdateStakeDto extends PartialType(CreateStakeDto) {}
