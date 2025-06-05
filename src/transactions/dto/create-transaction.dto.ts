import { z } from 'zod'

export const CreateTransactionSchema = z.object({
  transactionType: z.preprocess((val) => {
    const num = Number(val);
    return [1, 2].includes(num) ? num : val;
  }, z.union([z.literal(1), z.literal(2)])),
  amount: z.number(),
  date: z.string().datetime().or(z.string().date()),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid(),
  isRecurring: z.boolean().optional(),
  reccuringFrequency: z.number().optional().nullable(),
  reccuringStartDate: z.string().date().optional().nullable(),
  reccuringEndDate: z.string().date().optional().nullable(),
}).refine((data) => {
  // Ensure that if isRecurring is true, reccuringFrequency is provided
  if (data.isRecurring) {
    if (!data.reccuringFrequency || data.reccuringFrequency <= 0) {
      return false;
    }
    if (!data.reccuringStartDate) {
      return false;
    }
  }
  return true;
}, {
  message: 'If the transaction is recurring, reccuringFrequency and reccuringStartDate must be provided.',
}).refine((data) => {
  // Ensure that if reccuringEndDate is provided, it is after reccuringStartDate
  if (data.reccuringStartDate && data.reccuringEndDate) {
    return new Date(data.reccuringStartDate) < new Date(data.reccuringEndDate);
  }
  return true;
}, {
  message: 'If reccuringEndDate is provided, it must be after reccuringStartDate.',
});

export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>