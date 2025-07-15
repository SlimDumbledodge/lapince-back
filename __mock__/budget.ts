import * as schema from '../src/db/schema'

export const mockBudgetsResult: schema.Budget = {
  id: 'uuid_string',
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: 'user_uuid_string',
  categoryId: 'category_uuid_string',
  totalAmount: 1000,
  actualAmount: 800,
  recurringFrequency: 'monthly',
  recurringStartDate: '2023-01-01',
  lastResetDate: '2023-01-31',
}