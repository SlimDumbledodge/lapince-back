import { Controller, Get, Post, Body, Patch, Param, UsePipes, ParseUUIDPipe, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { UpdatePasswordDto, UpdatePasswordSchema } from './dto/update-password.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateUserSchema))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch()
  update(
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.usersService.update(user.id, updateUserDto);
  }

  @Patch('password')
  updatePassword(
    @Body(new ZodValidationPipe(UpdatePasswordSchema)) updateUserDto: UpdatePasswordDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.usersService.updatePassword(user.id, updateUserDto);
  }
}
