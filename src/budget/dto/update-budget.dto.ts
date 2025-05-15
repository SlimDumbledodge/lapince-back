import { z } from "zod";
import { CreateBudgetSchema } from "./create-budget.dto";

export const UpdateBudgetSchema = CreateBudgetSchema.partial();
export type UpdateBudgetDto = z.infer<typeof UpdateBudgetSchema>;