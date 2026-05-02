CREATE TABLE "whitelisted_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DELETE FROM "encounters" WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "encounters_user_id_idx" ON "encounters" USING btree ("user_id");
--> statement-breakpoint
-- Row Level Security policies. These reference Supabase's auth.uid() and only
-- apply on environments where the `auth` schema exists (i.e. Supabase). On
-- local Postgres and CI this block is a no-op; the app layer's WHERE filter
-- is the gate everywhere, RLS is defense-in-depth for production.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "encounters_select_own" ON "encounters" FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "encounters_insert_own" ON "encounters" FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "encounters_update_own" ON "encounters" FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "encounters_delete_own" ON "encounters" FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END
$$;
