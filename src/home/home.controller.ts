import { Controller, Get, Query } from '@nestjs/common';
import { HomeService } from './home.service';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  findAll(
    @User() user: UserEntity,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.homeService.findAll(user.id, startDate, endDate);
  }
}
