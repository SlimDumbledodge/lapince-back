import { pgTable, text, timestamp, varchar, uuid, boolean, integer, real, json, pgEnum, interval, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * User table
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar('first_name', { length: 64 }).notNull(),
  lastName: varchar('last_name', { length: 64 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  emailIdx: uniqueIndex('email_idx').on(t.email),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * User account table
 */
export const userAccounts = pgTable('user_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id).notNull(),
  accountName: varchar('account_name', { length: 64 }).notNull(),
  amount: real('amount').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userIdIdx: index('user_account_user_id_idx').on(t.userId),
}));

export type UserAccount = typeof userAccounts.$inferSelect;
export type NewUserAccount = typeof userAccounts.$inferInsert;

/**
 * Transaction table
 */
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userAccountId: uuid('user_account_id').references(() => userAccounts.id).notNull(),
  amount: real('amount').notNull(),
  date: timestamp('date').notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  isReccuring: boolean('is_reccuring').notNull().default(false),
  reccuringFrequency: integer('reccuring_frequency').default(30),
  reccuringStartDate: timestamp('reccuring_start_date'),
  reccuringEndDate: timestamp('reccuring_end_date'),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userAccountIdIdx: index('transaction_user_account_id_idx').on(t.userAccountId),
  categoryIdIdx: index('transaction_category_id_idx').on(t.categoryId),
}));

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/**
 * Category table
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 64 }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  color: varchar('color', { length: 10 }),
  icon: varchar('icon', { length: 64 }),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userIdIdx: index('category_user_id_idx').on(t.userId),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

/**
 * Budget table
 */
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  totalAmount: real('total_amount').notNull(),
  reccuringFrequency: integer('reccuring_frequency').default(30),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userIdIdx: index('budget_user_id_idx').on(t.userId),
  categoryIdIdx: index('budget_category_id_idx').on(t.categoryId),
}));

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

/**
 * Notification table
 */
export const notificationTypes = pgEnum('notification_type', ['transaction', 'budget', 'reminder']);
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: notificationTypes('type').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userIdIdx: index('notification_user_id_idx').on(t.userId),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
