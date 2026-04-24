import { Test, TestingModule } from '@nestjs/testing';
import { StakeService } from './staking.service';

describe('StakeService', () => {
  let service: StakeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StakeService],
    }).compile();

    service = module.get<StakeService>(StakeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
