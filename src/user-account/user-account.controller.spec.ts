import { Test, TestingModule } from '@nestjs/testing';
import { UserAccountController } from './user-account.controller';
import { UserAccountService } from './user-account.service';

describe('UserAccountController', () => {
  let controller: UserAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAccountController],
      providers: [UserAccountService],
    }).compile();

    controller = module.get<UserAccountController>(UserAccountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
