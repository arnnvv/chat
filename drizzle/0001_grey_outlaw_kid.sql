CREATE TABLE "chat_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_devices" ADD CONSTRAINT "chat_devices_user_id_chat_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chat_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_pub_key_idx" ON "chat_devices" USING btree ("user_id","public_key");