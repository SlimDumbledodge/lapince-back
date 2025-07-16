import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe, } from '@nestjs/common';
import { UserAccountService } from './user-account.service';
import { CreateUserAccountDto, CreateUserAccountSchema } from './dto/create-user-account.dto';
import { UpdateUserAccountDto, UpdateUserAccountSchema } from './dto/update-user-account.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('account')
export class UserAccountController {
  constructor(private readonly userAccountService: UserAccountService) {}

  /**
   * Create a new user account
   * @param createUserAccountDto
   * @returns
   */
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateUserAccountSchema)) createUserAccountDto: CreateUserAccountDto,
    @User() user: UserEntity,
  ) {
    return this.userAccountService.create(createUserAccountDto, user.id);
  }

  /**
   * Get one user account by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userAccountService.findOne(id);
  }

  /**
   * Get a user account by user id
   * @param id
   * @param updateUserAccountDto
   * @returns
   */
  @Get('user/:id')
  findOneByUserId(@Param('id', ParseUUIDPipe) id: string) {
    return this.userAccountService.findOneByUserId(id);
  }

  /**
   * Update a user account by his user id
   * @param id 
   * @param updateUserAccountDto 
   * @returns 
   */
  @Patch('user/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateUserAccountSchema)) updateUserAccountDto: UpdateUserAccountDto) {
    return this.userAccountService.update(id, updateUserAccountDto);
  }

  /**
   * Delete a user account by id
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userAccountService.remove(id);
  }
}
