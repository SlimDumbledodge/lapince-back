import { Controller, Get, Post, Body, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { FirstLoginDto, FirstLoginSchema } from './dto/first-login.dto';
import { UpdatePasswordDto, UpdatePasswordSchema } from './dto/update-password.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('first-login')
  firstLogin(
    @Body(new ZodValidationPipe(FirstLoginSchema)) firstLoginDto: FirstLoginDto,
    @User() user: UserEntity,
  ) {
    return this.usersService.firstLogin(firstLoginDto, user.id);
  }

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
