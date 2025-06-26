import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { UserAccountService } from 'src/user-account/user-account.service';
import { FirstLoginDto } from './dto/first-login.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
  ) {}

  /**
   * Create a new user
   * => This function will hash the password before saving it to the database
   * @param createUserDto
   * @returns schema.User
   */
  async create(createUserDto: CreateUserDto): Promise<schema.User> {
    // Verify if the email is unique in db
    const emailResponse = await this.findByEmail(createUserDto.email)

    if (emailResponse !== null && emailResponse !== undefined) {
      throw new BadRequestException('This email is already set !')
    }

    // Hash the user password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    const newUser = await this.db.insert(schema.users).values({
      firstName : createUserDto.firstName,
      lastName : createUserDto.lastName,
      email : createUserDto.email,
      password: hashedPassword,
      accountType: createUserDto.accountType,
      locale: createUserDto.locale,
      avatar: createUserDto.avatar,
      createdAt: new Date()
    }).returning()

    return newUser[0]
  }

  /**
   * Get all users
   * @returns schema.User[]
   */
  async findAll(): Promise<schema.User[]> {
    return this.db.select().from(schema.users).orderBy(asc(schema.users.lastName))
  }

  /**
   * Get a user by is Id
   * @param id 
   * @returns schema.User
   */
  async findOne(id: string): Promise<schema.User & {accountId: string, accountName: string, amount: number}> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .innerJoin(
       schema.userAccounts,
       eq(schema.userAccounts.userId, schema.users.id)
      )

    if (result.length === 0) {
      throw new NotFoundException(`A user with this id (${id})`)
    }

    return {
      ...result[0].users,
      accountId: result[0].user_accounts.id,
      accountName: result[0].user_accounts.accountName,
      amount: result[0].user_accounts.amount,
    }
  }

  /**
   * Get a user by is email
   * @param email 
   * @returns schema.User | null
   */
  async findByEmail(email: string): Promise<(schema.User & {accountId: string, accountName: string, amount: number, currency: string}) |null> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))

    if (result.length === 0) {
      return null
    }

    // Get the user account details
    const userAccount = await this.userAccountService.findOneByUserId(result[0].id)

    return {
      ...result[0],
      accountId: userAccount?.id ?? null,
      accountName: userAccount?.accountName ?? null,
      amount: userAccount?.amount ?? null,
      currency: userAccount?.currency ?? null,
    }
  }

  /**
   * Update a user
   * @param id 
   * @param updateUserDto 
   * @returns schema.User
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<schema.User> {
    if (updateUserDto.email) {
      // Verify if the email is not already used
      const emailResponse = await this.findByEmail(updateUserDto.email)

      if (emailResponse !== null && emailResponse !== undefined) {
        if (emailResponse.id !== id) {
          throw new BadRequestException('This email is already set !')
        }
      }
    }

    const result = await this.db.update(schema.users).set({
      ...updateUserDto,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, id))
    .returning()

    if (result.length === 0) {
      throw new BadRequestException('User not found')
    }

    return result[0]
  }

  /**
   * First login for a user
   * @param firstLoginDto 
   * @param userId
   * @returns schema.User
   */
  async firstLogin(firstLoginDto: FirstLoginDto, userId: string): Promise<schema.User> {
    return await this.db.transaction(async (tx) => {
      // Update the user account
      await tx.update(schema.userAccounts).set({
        accountName: firstLoginDto.accountName,
        amount: firstLoginDto.totalAmount,
        currency: firstLoginDto.currency,
        updatedAt: new Date() 
      })
      .where(eq(schema.userAccounts.userId, userId))

      // Update the user information
      const user = await tx.update(schema.users).set({
          locale: firstLoginDto.locale,
          firstLogin: false,
          updatedAt: new Date()
        }).where(eq(schema.users.id, userId))
        .returning()

      if (user.length === 0) {
        throw new BadRequestException('User not found')
      }

      // Return the updated user
      return user[0];
    })
  }

  /**
   * Update the user password
   * @param id
   * @param updatePasswordDto
   * @returns 
   */
  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto): Promise<{message: string}> {
    const user = await this.findOne(id)

    // Verify if the current password is correct
    const isPasswordValid = await bcrypt.compare(updatePasswordDto.currentPassword, user.password)

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect')
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(updatePasswordDto.newPassword, 10)

    // Update the user password
    const result = await this.db.update(schema.users).set({
      password: hashedNewPassword,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, id))
    .returning()

    if (result.length === 0) {
      throw new BadRequestException('User not found')
    }

    return {
      message: 'Password updated successfully',
    }
  }

  // remove(id: string) {
  //   return `This action removes a #${id} user`;
  // }
}
