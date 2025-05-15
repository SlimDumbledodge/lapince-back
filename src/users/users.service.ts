import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { UserAccountService } from 'src/user-account/user-account.service';

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
  async findByEmail(email: string): Promise<(schema.User & {accountId: string, accountName: string, amount: number}) |null> {
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

  async updatePassword() {
    return 'This function update the user password'
  }

  // remove(id: string) {
  //   return `This action removes a #${id} user`;
  // }
}
