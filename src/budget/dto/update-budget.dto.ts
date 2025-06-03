import { z } from "zod";
import { CreateBudgetSchema } from "./create-budget.dto";

export const UpdateBudgetSchema = z.object({
  totalAmount: z.number().optional(),
  reccuringFrequency: z.number().optional(),
  reccuringStartDate: z.string().optional(),
}).refine((data) => {
  if (data.reccuringStartDate) {
    return !isNaN(Date.parse(data.reccuringStartDate));
  }
  return true;
}, {
  message: "reccuringStartDate must be a valid ISO date string",
  path: ["reccuringStartDate"],
});

export type UpdateBudgetDto = z.infer<typeof UpdateBudgetSchema>;