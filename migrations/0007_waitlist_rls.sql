-- Enable RLS on waitlist_emails so it isn't readable via the public anon key
-- (PostgREST). No policy is defined, so anon/authenticated are denied entirely;
-- the server connects as the table owner and bypasses RLS, so /api/waitlist and
-- operator reads keep working. Vanilla Postgres — a no-op risk locally too.
ALTER TABLE "waitlist_emails" ENABLE ROW LEVEL SECURITY;
