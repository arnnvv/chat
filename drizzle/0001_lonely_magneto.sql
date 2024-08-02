DO $$ BEGIN
 CREATE TYPE "public"."friend_req_status" AS ENUM('pending', 'accepted', 'declined');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_friend_requests" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"requester_id" varchar(21) NOT NULL,
	"recipient_id" varchar(21) NOT NULL,
	"status" "friend_req_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_friend_requests" ADD CONSTRAINT "chat_friend_requests_requester_id_chat_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_friend_requests" ADD CONSTRAINT "chat_friend_requests_recipient_id_chat_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
