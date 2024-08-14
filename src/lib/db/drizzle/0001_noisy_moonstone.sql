CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"sender_id" varchar(21) NOT NULL,
	"recipient_id" varchar(21) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_chat_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipient_id_chat_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
