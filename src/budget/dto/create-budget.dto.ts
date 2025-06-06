import { z } from "zod";

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  totalAmount: z.number(),
  recurringFrequency: z.number().optional(),
  recurringStartDate: z.string().optional(),
}).refine((data) => {
  if (data.recurringFrequency !== undefined) {
    return !!data.recurringStartDate;
  }
  return true;
}, {
  message: "reccuringStartDate is required when reccuringFrequency is provided",
  path: ["reccuringStartDate"],
}).refine((data) => {
  if (data.recurringStartDate) {
    return !isNaN(Date.parse(data.recurringStartDate));
  }
  return true;
}, {
  message: "reccuringStartDate must be a valid ISO date string",
  path: ["reccuringStartDate"],
});

export type CreateBudgetDto = z.infer<typeof CreateBudgetSchema>;