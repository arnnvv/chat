import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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

export const users = createTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username").unique().notNull(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    password_hash: varchar("password_hash"),
    googleId: text("google_id").unique(),
    githubId: text("github_id").unique(),
    verified: boolean("verified").notNull().default(false),
    picture: text("picture"),
  },
  (table) => [
    check(
      "auth_method_check",
      sql`${table.password_hash} IS NOT NULL OR ${table.googleId} IS NOT NULL OR ${table.githubId} IS NOT NULL`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
}));

export const devices = createTable(
  "devices",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_id_pub_key_idx").on(table.userId, table.publicKey),
  ],
);

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;

export const sessions = createTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export type Session = typeof sessions.$inferSelect;

export const emailVerificationRequests = createTable(
  "email_verification_request",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
);

export type EmailVerificationRequest =
  typeof emailVerificationRequests.$inferSelect;

export const friendRequests = createTable(
  "friend_requests",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    index("friend_requests_recipient_status_idx").on(
      table.recipientId,
      table.status,
    ),
  ],
);

export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;

export const messages = createTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("messages_sender_recipient_created_idx").on(
      table.senderId,
      table.recipientId,
      sql`${table.createdAt} DESC`,
    ),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const deviceVerifications = createTable(
  "device_verifications",
  {
    verifierUserId: integer("verifier_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedDeviceId: integer("verified_device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.verifierUserId, table.verifiedDeviceId],
    }),
  ],
);
