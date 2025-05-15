import { z } from 'zod'

export const CreateTransactionSchema = z.object({
  transactionType: z.literal(1).or(z.literal(2)),
  amount: z.number(),
  date: z.string().date(),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid(),
  isRecurring: z.boolean().optional(),
  RecurringFrequency: z.number().optional().nullable(),
  RecurringStartDate: z.string().date().optional().nullable(),
  RecurringEndDate: z.string().date().optional().nullable(),
})

export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>