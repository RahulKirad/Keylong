-- Profile photos per traveller (shared across all logins).
CREATE TABLE IF NOT EXISTS trip_traveller_profiles (
  person_id text PRIMARY KEY,
  person_name text NOT NULL,
  photo_data_url text,
  updated_at bigint
);

ALTER TABLE trip_traveller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON trip_traveller_profiles;
CREATE POLICY "anon_select_profiles" ON trip_traveller_profiles FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_profiles" ON trip_traveller_profiles;
CREATE POLICY "anon_insert_profiles" ON trip_traveller_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_profiles" ON trip_traveller_profiles;
CREATE POLICY "anon_update_profiles" ON trip_traveller_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_profiles" ON trip_traveller_profiles;
CREATE POLICY "anon_delete_profiles" ON trip_traveller_profiles FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_traveller_profiles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
