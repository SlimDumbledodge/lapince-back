import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { CreateBudgetDto, CreateBudgetSchema } from './dto/create-budget.dto';
import { UpdateBudgetDto, UpdateBudgetSchema } from './dto/update-budget.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from 'src/decorator/user.decorator';

@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  /**
   * Create a new budget
   * @param createBudgetDto 
   * @returns 
   */
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateBudgetSchema)) createBudgetDto: CreateBudgetDto,
    @User() user: UserEntity
  ) {
    return this.budgetService.create(createBudgetDto, user.id);
  }

  /**
   * Get all budget by user id
   * @returns 
   */
  @Get()
  findAll(@User() user: UserEntity) {
    return this.budgetService.findAllByUserId(user.id);
  }

  /**
   * Get a budget by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity) {
    return this.budgetService.findOne(id, user.id);
  }

  /**
   * Update a budget
   * @param id 
   * @param updateBudgetDto 
   * @returns 
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(new ZodValidationPipe(UpdateBudgetSchema)) updateBudgetDto: UpdateBudgetDto,
    @User() user: UserEntity
  ) {
    return this.budgetService.update(id, updateBudgetDto, user.id);
  }

  /**
   * Delete a budget
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity) {
    return this.budgetService.remove(id, user.id);
  }
}
