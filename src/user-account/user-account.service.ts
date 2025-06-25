import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class UserAccountService {
  private readonly logger = new Logger(UserAccountService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
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

  /**
   * Update the total amount after a transaction of a user account by id.
   * @param userId
   * @param type (1 = income, 2 = expense)
   * @param amount
   * @returns
   */
  async updateTotalAmount(userId: string, type: number, amount: number): Promise<schema.UserAccount>  {
    const userAccount = await this.findOneByUserId(userId)

    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    const totalAmount = userAccount.amount + (type === 1 ? amount : -amount)
    const result = await this.db.update(schema.userAccounts).set({
      amount : totalAmount,
      updatedAt: new Date(),
    }).where(eq(schema.userAccounts.userId, userId)).returning()

    if (result[0].amount < 0) {
      try {
        await this.notificationsService.create({
          level: 'warning',
          type: 'reminder',
          message: `Your account balance is negative: ${result[0].amount} EUR.`,
        }, userId);
      } catch (error) {
        this.logger.error('Error sending notification:', error);
      }
    }

    return result[0];
  }

  async remove(id: string): Promise<void> {
    return this.db.delete(schema.userAccounts).where(eq(schema.userAccounts.id, id))
  }
}
