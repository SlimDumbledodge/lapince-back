import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe, Req, BadRequestException, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, CreateTransactionSchema } from './dto/create-transaction.dto';
import { UpdateTransactionDto, UpdateTransactionSchema } from './dto/update-transaction.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Request } from 'express';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Create a new transaction
   * @param createTransactionDto 
   * @returns 
   */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateTransactionSchema))
  create(
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.transactionsService.create(createTransactionDto, user.id);
  }

  /**
   * Get all transactions for a user
   * @returns 
   */
  @Get()
  findAll(
    @Req() req: Request,
    @Query('limit') limit: number = 10,
    @Query('page') offset: number = 0,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.transactionsService.findAll(user.id, +limit, +offset);
  }

  /**
   * Get a transaction by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.transactionsService.findOne(id, user.id);
  }

  /**
   * Update a transaction
   * @param id 
   * @param updateTransactionDto 
   * @param req 
   * @returns 
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateTransactionDto: UpdateTransactionDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.transactionsService.update(id, updateTransactionDto, user.id);
  }

  /**
   * Delete a transaction
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.transactionsService.remove(id, user.id);
  }
}
