CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"name" varchar,
	"email" varchar(255) NOT NULL,
	"number" varchar,
	"password" varchar(255) NOT NULL,
	CONSTRAINT "chat_users_email_unique" UNIQUE("email"),
	CONSTRAINT "chat_users_number_unique" UNIQUE("number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_chat_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chat_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
