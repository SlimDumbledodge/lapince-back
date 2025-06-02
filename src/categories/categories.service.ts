import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from 'src/db/schema';
import { eq, or, isNull } from 'drizzle-orm';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new category
   * @param createCategoryDto 
   * @param userId
   * @returns 
   */
  async create(createCategoryDto: CreateCategoryDto, userId: string): Promise<schema.Category>  {
    const category = await this.db.insert(schema.categories).values({
      ...createCategoryDto,
      userId,
    }).returning();

    return category[0];
  }

  /**
   * Get all categories
   * @param userId
   * @returns 
   */
  async findAll(userId: string): Promise<schema.Category[]>  {
    return this.db.select().from(schema.categories).where(or(eq(schema.categories.userId, userId), isNull(schema.categories.userId)));
  }

  /**
   * Get a category by id
   * @param id 
   * @param userId
   * @returns 
   */
  async findOne(id: string, userId: string): Promise<schema.Category> {
    const result = await this.db.select().from(schema.categories).where(eq(schema.categories.id, id))
    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }

    if (result[0].userId !== null && result[0].userId !== userId) {
      throw new NotFoundException('This category does not belong to your account');
    }

    return result[0];
  }

  /**
   * Update a category by id
   * @param id 
   * @param userId
   * @param updateCategoryDto 
   * @returns 
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto, userId: string): Promise<schema.Category> {
    const category = await this.findOne(id, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.userId !== userId || category.userId === null) {
      throw new BadRequestException('You can only update your own categories');
    }

    const result = await this.db.update(schema.categories).set({
      ...updateCategoryDto,
      updatedAt: new Date(),
    }).where(eq(schema.categories.id, id)).returning();
    return result[0];
  }

  /**
   * Delete a category by id
   * @param id 
   * @param userId
   * @returns 
   */
  async remove(id: string, userId: string): Promise<void> {
    const category = await this.findOne(id, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.userId!== userId || category.userId === null) {
      throw new BadRequestException('You can only delete your own categories');
    }

    return this.db.delete(schema.categories).where(eq(schema.categories.id, id)).then(() => undefined);
  }
}
