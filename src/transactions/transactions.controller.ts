import { Controller, Get, Post, Body, Patch, Param, Delete, ParseBoolPipe, ParseUUIDPipe, Query, DefaultValuePipe } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, CreateTransactionSchema } from './dto/create-transaction.dto';
import { UpdateTransactionDto, UpdateTransactionSchema } from './dto/update-transaction.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Create a new transaction
   * @param createTransactionDto 
   * @returns 
   */
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateTransactionSchema)) createTransactionDto: CreateTransactionDto,
    @User() user: UserEntity,
  ) {
    return this.transactionsService.create(createTransactionDto, user.id);
  }

  /**
   * Get all transactions for a user
   * @returns 
   */
  @Get()
  findAll(
    @User() user: UserEntity,
    @Query('limit') limit: number = 10,
    @Query('page') offset: number = 0,
  ) {
    return this.transactionsService.findAll(user.id, +limit, +offset);
  }

  /**
   * Get a transaction by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity,) {
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
    @Body(new ZodValidationPipe(UpdateTransactionSchema)) updateTransactionDto: UpdateTransactionDto,
    @User() user: UserEntity,
    @Query('updateNextChilds', new DefaultValuePipe(false), ParseBoolPipe) updateNextChilds: boolean = false,
  ) {
    return this.transactionsService.update(id, updateTransactionDto, user.id, updateNextChilds);
  }

  /**
   * Delete a transaction
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string, 
    @User() user: UserEntity,
    @Query('removeChildren') removeChildren: boolean = false,
  ) {
    return this.transactionsService.remove(id, user.id, removeChildren);
  }

  /**
   * Stop a recurring transaction
   * @param id
   */
  @Delete('recurring/stop/:id')
  stopRecurringTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: UserEntity,
  ) {
    return this.transactionsService.stopRecurringTransaction(id, user.id);
  }
}
