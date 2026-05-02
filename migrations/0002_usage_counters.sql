CREATE TABLE "usage_counters" (
	"user_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"voice_transcriptions" integer DEFAULT 0 NOT NULL,
	"tts_calls" integer DEFAULT 0 NOT NULL,
	"parse_calls" integer DEFAULT 0 NOT NULL,
	"search_calls" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_user_id_year_month_pk" PRIMARY KEY("user_id","year_month")
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "usage_counters_select_own" ON "usage_counters" FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "usage_counters_insert_own" ON "usage_counters" FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "usage_counters_update_own" ON "usage_counters" FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "usage_counters_delete_own" ON "usage_counters" FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END
$$;
