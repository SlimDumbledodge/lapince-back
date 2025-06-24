import { z } from 'zod'

export const CreateTransactionSchema = z.object({
  transactionType: z.preprocess((val) => {
    const num = Number(val);
    return [1, 2].includes(num) ? num : val;
  }, z.union([z.literal(1), z.literal(2)])),
  amount: z.number().min(0.01, { message: 'Amount must be greater than 0.01' }),
  date: z.string().datetime().or(z.string().date()),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.number().optional().nullable(),
  recurringStartDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  recurringEndDate: z.string().datetime().or(z.string().date()).optional().nullable(),
}).refine((data) => {
  // Ensure that if isRecurring is true, recurringFrequency is provided
  if (data.isRecurring) {
    if (!data.recurringFrequency || data.recurringFrequency <= 0) {
      return false;
    }
    if (!data.recurringStartDate) {
      return false;
    }
  }
  return true;
}, {
  message: 'If the transaction is recurring, recurringFrequency and recurringStartDate must be provided.',
}).refine((data) => {
  // Ensure that if recurringEndDate is provided, it is after recurringStartDate
  if (data.recurringStartDate && data.recurringEndDate) {
    return new Date(data.recurringStartDate) < new Date(data.recurringEndDate);
  }
  return true;
}, {
  message: 'If recurringEndDate is provided, it must be after recurringStartDate.',
});

export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>