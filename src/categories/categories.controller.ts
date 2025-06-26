import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe, Query, DefaultValuePipe, ParseBoolPipe} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, CreateCategorySchema } from './dto/create-category.dto';
import { UpdateCategoryDto, UpdateCategorySchema } from './dto/update-category.dto';
import { DeleteCategoryDto } from './dto/delete-category.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Create a new category
   * @param createCategoryDto 
   * @returns 
   */
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) createCategoryDto: CreateCategoryDto,
    @User() user: UserEntity,
  ) {
    return this.categoriesService.create(createCategoryDto, user.id);
  }

  /**
   * Get all categories
   * @returns 
   */
  @Get()
  findAll(@User() user: UserEntity,) {
    return this.categoriesService.findAll(user.id);
  }

  /**
   * Get a category by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity,) {
    return this.categoriesService.findOne(id, user.id);
  }

  /**
   * Update a category by id. The user must be the owner of the category.
   * @param id 
   * @param updateCategoryDto 
   * @returns 
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(new ZodValidationPipe(UpdateCategorySchema)) updateCategoryDto: UpdateCategoryDto,
    @User() user: UserEntity,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, user.id);
  }

  /**
   * Delete a category by id. The user must be the owner of the category.
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string, 
    @User() user: UserEntity,
    @Query('replaceOldTransactionsCategoryId', new DefaultValuePipe(false), ParseBoolPipe) replaceOldTransactionsCategoryId: boolean = false,
    @Query('newCategoryId', new DefaultValuePipe(undefined)) newCategoryId: string | undefined = undefined,
  ) {
    return this.categoriesService.remove(id, user.id, {
      replaceOldTransactionsCategoryId,
      newCategoryId,
    } as DeleteCategoryDto);
  }
}
