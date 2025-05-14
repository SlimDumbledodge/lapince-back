import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ConfigService } from "@nestjs/config";
import * as schema from '../schema'
export const DrizzleAsyncProvider = 'DrizzleAsyncProvider'
import { NodePgDatabase } from "drizzle-orm/node-postgres";

export const drizzleProvider = [
  {
    provide: DrizzleAsyncProvider,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const connectionString = configService.get<string>('DATABASE_URL');
      const pool = new Pool({ connectionString });
      return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;
    }
  }
]