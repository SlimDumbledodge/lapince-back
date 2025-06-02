import { z } from "zod";

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  totalAmount: z.number(),
  reccuringFrequency: z.number().optional(),
  reccuringStartDate: z.string().optional(),
}).refine((data) => {
  if (data.reccuringFrequency !== undefined) {
    return !!data.reccuringStartDate;
  }
  return true;
}, {
  message: "reccuringStartDate is required when reccuringFrequency is provided",
  path: ["reccuringStartDate"],
}).refine((data) => {
  if (data.reccuringStartDate) {
    return !isNaN(Date.parse(data.reccuringStartDate));
  }
  return true;
}, {
  message: "reccuringStartDate must be a valid ISO date string",
  path: ["reccuringStartDate"],
});

export type CreateBudgetDto = z.infer<typeof CreateBudgetSchema>;