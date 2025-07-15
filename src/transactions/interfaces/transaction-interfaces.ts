import * as schema from 'src/db/schema';

/**
 * Result interface for recurring transaction processing
 */
export interface RecurringTransactionResult {
  lastTransactionDate: Date;
  lastTransactionId: string;
  transaction: schema.Transaction;
}

/**
 * Type alias for database transaction compatibility
 * This allows us to use any instead of specific transaction types
 * In a real project, you should use specific PostgreSQL transaction types
 */
export type DatabaseTransaction = any;

/**
 * Interface for paginated transaction results
 */
export interface PaginatedTransactions {
  data: schema.Transaction[];
  limit: number;
  page: number;
  total: number;
  lastPage: number;
}
