import { z } from 'zod';
import { getClosestFrequency } from 'src/common/validator/closest-frequency';

const budgetFrequencyEnum = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
const budgetFrequency = z.enum(budgetFrequencyEnum);

export const UpdateTransactionSchema = z.object({
  transactionType: z.preprocess((val) => {
    const num = Number(val);
    return [1, 2].includes(num) ? num : val;
  }, z.union([z.literal(1), z.literal(2)])).optional(),
  amount: z.number().min(0.01, { message: 'Amount must be greater than 0.01' }).optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z
    .union([budgetFrequency, z.number().int()])
    .optional()
    .nullable()
    .transform((value) => {
      if (typeof value === 'number') {
        return getClosestFrequency(value);
      }
      return value;
    }),
  recurringEndDate: z.string().date().optional().nullable(),
})

export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>;