import { Injectable, Inject } from '@nestjs/common';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

@Injectable()
export class HomeService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Get all home data
   * @param userId - The ID of the user
   */
  async findAll(userId: string) {
    return `This action returns all home`;
  }

  /**
   * Get the hebdo data
   * @param userId - The ID of the user
   */
  private async getHebdo() {
    
  }
}
