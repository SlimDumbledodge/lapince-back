import { z } from 'zod';

export const UpdateTransactionSchema = z.object({
  transactionType: z.preprocess((val) => {
    const num = Number(val);
    return [1, 2].includes(num) ? num : val;
  }, z.union([z.literal(1), z.literal(2)])).optional(),
  amount: z.number().optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  isRecurring: z.boolean().optional(),
  reccuringFrequency: z.number().optional().nullable(),
  reccuringStartDate: z.string().date().optional().nullable(),
  reccuringEndDate: z.string().date().optional().nullable(),
})

export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>;