import { z } from 'zod';
import { CreateTransactionSchema } from './create-transaction.dto';

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>;