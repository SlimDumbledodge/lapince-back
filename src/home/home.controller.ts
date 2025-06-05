import { Controller, Get, Req, BadRequestException } from '@nestjs/common';
import { HomeService } from './home.service';
import { Request } from 'express';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  findAll(@Req() req: Request) {

    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.homeService.findAll(user.id);
  }
}
