import { pgTable, uuid, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  isactive: boolean('isactive').default(false).notNull(),
  isArchived: boolean('isArchived').default(false).notNull(),
  archivedAt: timestamp('archivedAt'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  hostUsername: text('hostUsername'),
  hostPassword: text('hostPassword'),
});

export const donations = pgTable('donations', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id').notNull(), // references events.id (but we don't strictly need the FK constraint for this migration)
  donorName: text('donorName').notNull(),
  fatherName: text('fatherName'),
  mobile: text('mobile').notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  hideName: boolean('hideName').default(false),
  paymentType: text('paymentType').notNull(),
  receiptImage: text('receiptImage'),
  status: text('status').default('pending'), // 'pending' | 'approved'
  smsStatus: text('smsStatus'),
  smsError: text('smsError'),
  batchSmsId: text('batchSmsId'),
  registeredBy: text('registeredBy'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
});

export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  displayName: text('displayName'),
  role: text('role').notNull(),
});


