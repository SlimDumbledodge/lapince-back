const budgetFrequencyEnum = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
type BudgetFrequency = typeof budgetFrequencyEnum[number];

const frequencyToDays: Record<BudgetFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

// Convert a number of days to the closest budget frequency 
export function getClosestFrequency(value: number): BudgetFrequency {
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