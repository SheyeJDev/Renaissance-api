import { Test, TestingModule } from '@nestjs/testing';
import { StakeController } from './staking.controller';
import { StakeService } from './staking.service';

describe('StakeController', () => {
  let controller: StakeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StakeController],
      providers: [StakeService],
    }).compile();

    controller = module.get<StakeController>(StakeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
