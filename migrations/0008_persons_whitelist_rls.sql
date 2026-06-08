-- Enable RLS on persons and whitelisted_emails so neither is readable/writable via the public
-- anon key (PostgREST). No policy is defined, so anon/authenticated are denied entirely; the
-- server connects as the table owner and bypasses RLS, so app reads/writes keep working.
--
-- Both tables already have RLS enabled in production (it was applied out-of-band, never via a
-- migration). This records that posture in version control so a fresh build — CI, a new
-- environment — reproduces it, instead of silently shipping persons (names + AI summaries) and
-- the invite allow-list readable by anyone holding the anon key. Mirrors 0007_waitlist_rls.
--
-- ENABLE ROW LEVEL SECURITY is idempotent (a no-op where it's already on), and it's vanilla
-- Postgres — so applying this to prod is a no-op and it's a no-op locally too (tests connect as
-- the owner). No auth.uid() policy is needed: these tables are only ever touched server-side.
ALTER TABLE "persons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whitelisted_emails" ENABLE ROW LEVEL SECURITY;
