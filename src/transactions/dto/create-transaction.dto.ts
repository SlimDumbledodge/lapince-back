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
})

export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>