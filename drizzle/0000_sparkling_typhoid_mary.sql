CREATE TYPE "public"."friend_req_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "chat_email_verification_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_friend_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"status" "friend_req_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"picture" text,
	CONSTRAINT "chat_users_username_unique" UNIQUE("username"),
	CONSTRAINT "chat_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_email_verification_request" ADD CONSTRAINT "chat_email_verification_request_user_id_chat_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_friend_requests" ADD CONSTRAINT "chat_friend_requests_requester_id_chat_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_friend_requests" ADD CONSTRAINT "chat_friend_requests_recipient_id_chat_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_chat_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipient_id_chat_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_chat_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;