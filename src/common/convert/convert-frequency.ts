import dayjs, { ManipulateType } from 'dayjs';

type BudgetFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

const frequencyToDayjsPeriod: Record<BudgetFrequency, { value: number; unit: ManipulateType }> = {
  weekly: { value: 1, unit: 'week' },
  biweekly: { value: 2, unit: 'week' },
  monthly: { value: 1, unit: 'month' },
  quarterly: { value: 3, unit: 'month' },
  yearly: { value: 1, unit: 'year' },
};

export function convertFrequencyToDayjsPeriod(frequency: BudgetFrequency | number): { value: number; unit: ManipulateType } {
  if (typeof frequency === 'number') {
    return { value: frequency, unit: 'day' };
  }
  
  return frequencyToDayjsPeriod[frequency];
}
