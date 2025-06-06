import { z } from "zod";
import { CreateBudgetSchema } from "./create-budget.dto";

export const UpdateBudgetSchema = z.object({
  totalAmount: z.number().optional(),
  recurringFrequency: z.number().optional(),
  recurringStartDate: z.string().optional(),
}).refine((data) => {
  if (data.recurringStartDate) {
    return !isNaN(Date.parse(data.recurringStartDate));
  }
  return true;
}, {
  message: "reccuringStartDate must be a valid ISO date string",
  path: ["reccuringStartDate"],
});

export type UpdateBudgetDto = z.infer<typeof UpdateBudgetSchema>;