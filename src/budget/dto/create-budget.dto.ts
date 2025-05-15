import { z } from "zod";

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  totalAmount: z.number(),
  reccuringFrequency: z.number().optional(),
})

export type CreateBudgetDto = z.infer<typeof CreateBudgetSchema>;
