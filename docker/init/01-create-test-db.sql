-- Auto-runs on first container init (fresh volumes only).
-- For existing volumes, create manually:
--   docker exec who-that-postgres psql -U who_that -d postgres -c "CREATE DATABASE who_that_test;"
CREATE DATABASE who_that_test;
