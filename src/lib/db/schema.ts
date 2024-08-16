import {
  pgEnum,
  pgTableCreator,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator(
  (name: string): string => `chat_${name}`,
);

export const friendReqStatusEnum = pgEnum("friend_req_status", [
  "pending",
  "accepted",
  "declined",
]);

export const users = createTable("users", {
  id: varchar("id", { length: 21 }).primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  number: varchar("number").unique(),
  password: varchar("password", { length: 255 }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = createTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 21 })
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const friendRequests = createTable("friend_requests", {
  id: varchar("id", { length: 255 }).primaryKey(),
  requesterId: varchar("requester_id", { length: 21 })
    .notNull()
    .references(() => users.id),
  recipientId: varchar("recipient_id", { length: 21 })
    .notNull()
    .references(() => users.id),
  status: friendReqStatusEnum("status").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;

export const messages = createTable("messages", {
  id: varchar("id", { length: 255 }).primaryKey(),
  senderId: varchar("sender_id", { length: 21 })
    .notNull()
    .references(() => users.id),
  recipientId: varchar("recipient_id", { length: 21 })
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export type Message = typeof messages.$inferSelect;
