import { pgTable, text, timestamp, varchar, uuid, boolean, integer, real, json, pgEnum, interval, uniqueIndex, index, date, foreignKey } from 'drizzle-orm/pg-core';
import { is, sql } from 'drizzle-orm';
import { locales as localesZone } from './constants/locale';
import { currencys as currencysZones } from './constants/currency';

export const rawFrequency = pgEnum('raw_frequency', ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])

/**
 * User table
 */
export const accountTypes = pgEnum('account_type', ['in-app', 'google']);
export const locales = pgEnum('locale', localesZone);
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar('first_name', { length: 64 }).notNull(),
  lastName: varchar('last_name', { length: 64 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  accountType: accountTypes('account_type').default('in-app').notNull(),
  avatar: varchar('avatar', { length: 255 }).default('https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y').notNull(),
  locale: locales('locale').default('fr-FR').notNull(),
  firstLogin: boolean('first_login').notNull().default(true),
  verifiedEmail: boolean('verified_email').notNull().default(false),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  emailIdx: uniqueIndex('email_idx').on(t.email),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Session table
 */
export const sessionTypes = pgEnum('session_connexion_type', ['in-app', 'google']);
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  sessionType: sessionTypes('session_type').default('in-app').notNull(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('token_hash_idx').on(t.tokenHash),
  userIdIdx: index('session_user_id_idx').on(t.userId),
}))

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/**
 * User account table
 */
export const currencys = pgEnum('currency', currencysZones);
export const userAccounts = pgTable('user_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id).notNull(),
  accountName: varchar('account_name', { length: 64 }).notNull(),
  amount: real('amount').notNull(),
  currency: currencys('currency').default('EUR').notNull(),
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
  transactionType: integer('transaction_type').default(2).notNull(), // 1 = income, 2 = expense
  date: timestamp('date').notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringFrequency: rawFrequency('recurring_frequency').default('monthly'),
  recurringStartDate: timestamp('recurring_start_date'),
  recurringEndDate: timestamp('recurring_end_date'),
  recurringParentId: uuid('recurring_parent_id'), // For reccuring transactions, link to the parent transaction
  metadata: json('metadata').$type<Record<string, any>>().default({}).notNull(), // Store additional data like payment method, location, etc.
  isDeleted: boolean('is_deleted').notNull().default(false), // Soft delete
  isOrphaned: boolean('is_orphaned').notNull().default(false), // For transactions that are not linked to any recurrency but with recurrency indicator
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userAccountIdIdx: index('transaction_user_account_id_idx').on(t.userAccountId),
  categoryIdIdx: index('transaction_category_id_idx').on(t.categoryId),
  parentReference: foreignKey({
    columns: [t.recurringParentId],
    foreignColumns: [t.id],
    name: 'transaction_recurring_parent_fk',
  })
}));

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/**
 * Transaction Reccuring info table
 */
export const transactionRecurringInfo = pgTable('transaction_recurring_info', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  transactionParentId: uuid('transaction_parent_id').references(() => transactions.id).notNull(),
  lastTransactionDate: timestamp('last_transaction_date').notNull(),
  lastTransactionId: uuid('last_transaction_id').references(() => transactions.id).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  transactionParentIdIdx: index('transaction_recurring_info_transaction_parent_id_idx').on(t.transactionParentId),
  lastTransactionIdIdx: index('transaction_recurring_info_last_transaction_id_idx').on(t.lastTransactionId),
}));

export type TransactionRecurringInfo = typeof transactionRecurringInfo.$inferSelect;
export type NewTransactionRecurringInfo = typeof transactionRecurringInfo.$inferInsert;

/**
 * Category table
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 64 }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  color: varchar('color', { length: 10 }),
  icon: varchar('icon', { length: 64 }),
  isDefault: boolean('is_default').notNull().default(false), // Indicates if the category is a default one
  isDeleted: boolean('is_deleted').notNull().default(false), // Soft delete
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
  actualAmount: real('actual_amount').default(0).notNull(),
  recurringFrequency: rawFrequency('recurring_frequency').notNull().default('monthly'),
  recurringStartDate: date('recurring_start_date').default(sql`now()`).notNull(),
  lastResetDate: date('last_reset_date').default(sql`now()`).notNull(),
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
export const notificationLevels = pgEnum('notification_level', ['success', 'info', 'warning', 'error']);
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: notificationTypes('type').notNull(),
  message: text('message').notNull(),
  level: notificationLevels('level').notNull().default('info'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (t) => ({
  userIdIdx: index('notification_user_id_idx').on(t.userId),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
