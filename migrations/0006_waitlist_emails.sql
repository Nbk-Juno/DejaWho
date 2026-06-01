CREATE TABLE "waitlist_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"source" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_at" timestamp with time zone
);
