import { Injectable, Inject } from '@nestjs/common';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UserAccountService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new user account.
   * @param createUserAccountDto 
   * @param userId
   * @returns 
   */
  async create(createUserAccountDto: CreateUserAccountDto, userId: string): Promise<schema.UserAccount>  {
    const result = await this.db.insert(schema.userAccounts).values({
      userId,
      ...createUserAccountDto,
      createdAt: new Date(),
    }).returning()
    return result[0];
  }

  /**
   * Find all user accounts.
   * @returns 
   */
  async findAll(): Promise<schema.UserAccount[]> {
    return this.db.select().from(schema.userAccounts)
  }

  /**
   * Find one user account by id.
   * @param id 
   * @returns 
   */
  async findOne(id: string): Promise<schema.UserAccount>  {
    const result = await this.db.select().from(schema.userAccounts).where(eq(schema.userAccounts.id, id))
    return result[0];
  }

  /**
   * Find one user account by userId.
   * @param userId
   * @returns
   */
  async findOneByUserId(userId: string): Promise<schema.UserAccount>  {
    const result = await this.db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
    return result[0];
  }

  /**
   * Update a user account by is id.
   * @param id 
   * @param updateUserAccountDto 
   * @returns 
   */
  async update(id: string, updateUserAccountDto: UpdateUserAccountDto): Promise<schema.UserAccount>  {
    const result = await this.db.update(schema.userAccounts).set({
      ...updateUserAccountDto,
      updatedAt: new Date(),
    }).where(eq(schema.userAccounts.id, id)).returning()
    return result[0];
  }

  async remove(id: string): Promise<void> {
    return this.db.delete(schema.userAccounts).where(eq(schema.userAccounts.id, id))
  }
}
