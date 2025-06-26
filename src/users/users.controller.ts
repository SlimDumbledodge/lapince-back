import { Controller, Get, Post, Body, Patch, Param, UsePipes, ParseUUIDPipe, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { UpdatePasswordDto, UpdatePasswordSchema } from './dto/update-password.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findOne(@User() user: UserEntity,) {
    return this.usersService.findOne(user.id);
  }

  @Patch()
  update(
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
    @User() user: UserEntity,
  ) {
    return this.usersService.update(user.id, updateUserDto);
  }

  @Patch('password')
  updatePassword(
    @Body(new ZodValidationPipe(UpdatePasswordSchema)) updateUserDto: UpdatePasswordDto,
    @User() user: UserEntity,
  ) {
    return this.usersService.updatePassword(user.id, updateUserDto);
  }
}
