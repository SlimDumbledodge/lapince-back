import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe, Req, BadRequestException } from '@nestjs/common';
import { UserAccountService } from './user-account.service';
import { CreateUserAccountDto, CreateUserAccountSchema } from './dto/create-user-account.dto';
import { UpdateUserAccountDto, UpdateUserAccountSchema } from './dto/update-user-account.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Request } from 'express';

@Controller('account')
export class UserAccountController {
  constructor(private readonly userAccountService: UserAccountService) {}

  /**
   * Create a new user account
   * @param createUserAccountDto
   * @returns
   */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateUserAccountSchema))
  create(
    @Body() createUserAccountDto: CreateUserAccountDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user || !user.id) {
      throw new BadRequestException('User not found')
    }

    return this.userAccountService.create(createUserAccountDto, user.id);
  }

  /**
   * Get all user accounts
   * @param req 
   * @returns 
   */
  @Get()
  findAll(@Req() req: Request,) {
    return this.userAccountService.findAll();
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
   * Update a user account by id
   * @param id 
   * @param updateUserAccountDto 
   * @returns 
   */
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserAccountDto: UpdateUserAccountDto) {
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
