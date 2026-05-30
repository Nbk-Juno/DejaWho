-- Promote persons to a real identity table so two people with the same first name can be
-- kept apart. Encounters now link to a person by stable id (not just by name string).

ALTER TABLE encounters ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE persons ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS location_tag TEXT;

-- Multiple same-name persons are now allowed: drop the unique constraint, keep a plain lookup index.
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_user_id_normalized_name_key;
DROP INDEX IF EXISTS persons_user_id_name_key;
CREATE INDEX IF NOT EXISTS persons_user_id_name_idx ON persons(user_id, normalized_name);

CREATE INDEX IF NOT EXISTS encounters_person_id_idx ON encounters(person_id);

-- Backfill is 1:1 today (identity == normalized name), so every encounter maps to its person.
UPDATE encounters e
SET person_id = p.id
FROM persons p
WHERE e.person_id IS NULL
  AND e.user_id = p.user_id
  AND lower(trim(e.name)) = p.normalized_name;
