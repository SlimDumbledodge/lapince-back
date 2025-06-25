import { z } from "zod";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

const today = dayjs().startOf("day").toDate();

const budgetFrequencyEnum = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
const budgetFrequency = z.enum(budgetFrequencyEnum);
type BudgetFrequency = typeof budgetFrequencyEnum[number];

const frequencyToDays: Record<BudgetFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

// Convert a number of days to the closest budget frequency 
function getClosestFrequency(value: number): BudgetFrequency {
  let closest: BudgetFrequency = 'weekly';
  let minDiff = Infinity;

  for (const [freq, days] of Object.entries(frequencyToDays)) {
    const diff = Math.abs(value - days);
    if (diff < minDiff) {
      minDiff = diff;
      closest = freq as BudgetFrequency;
    }
  }

  return closest;
}

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  totalAmount: z.number(),
  recurringFrequency: z
    .union([budgetFrequency, z.number().int()])
    .optional()
    .transform((value) => {
      if (typeof value === 'number') {
        return getClosestFrequency(value);
      }
      return value;
    }),
  recurringStartDate: z.string().optional(),
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