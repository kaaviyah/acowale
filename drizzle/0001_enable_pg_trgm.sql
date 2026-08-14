-- Trigram matching for the dashboard's free-text search.
--
-- Without pg_trgm, `comment ILIKE '%term%'` can only be answered with a
-- sequential scan over every row — fine at 200 rows, not at 200,000. The
-- extension makes a GIN index usable for leading-wildcard patterns; that index is
-- declared in src/server/db/schema.ts and created by the next migration.
--
-- Available on Neon by default, and in PGlite via its bundled contrib build, so
-- local, test, and production all run this same statement.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
