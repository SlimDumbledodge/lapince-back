import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ParseUUIDPipe, Req, BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, CreateCategorySchema } from './dto/create-category.dto';
import { UpdateCategoryDto, UpdateCategorySchema } from './dto/update-category.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Request } from 'express';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Create a new category
   * @param createCategoryDto 
   * @returns 
   */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateCategorySchema))
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.categoriesService.create(createCategoryDto, user.id);
  }

  /**
   * Get all categories
   * @returns 
   */
  @Get()
  findAll(@Req() req: Request,) {
    const user = req['user']

    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }

    return this.categoriesService.findAll(user.id);
  }

  /**
   * Get a category by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
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
    @Req() req: Request,
  ) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.categoriesService.update(id, updateCategoryDto, user.id);
  }

  /**
   * Delete a category by id. The user must be the owner of the category.
   * @param id 
   * @returns 
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.categoriesService.remove(id, user.id);
  }
}
