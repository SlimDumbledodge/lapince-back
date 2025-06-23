import { z } from "zod";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

const today = dayjs().startOf("day").toDate();

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
})
.refine((data) => {
  if (data.recurringStartDate) {
    return dayjs(data.recurringStartDate).startOf("day").isSameOrBefore(today);
  }
  return true;
}, {
  message: "recurringStartDate must be today or in the past",
  path: ["recurringStartDate"],
});

export type CreateBudgetDto = z.infer<typeof CreateBudgetSchema>;