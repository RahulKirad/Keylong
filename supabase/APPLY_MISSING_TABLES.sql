-- Run this once in Supabase Dashboard → SQL Editor → New query → Run
-- Fixes 404 on trip_settlements / trip_traveller_profiles and keeps Splitwise in sync.

-- Expense split columns (safe if already present)
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS count_in_total boolean DEFAULT true;
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS split_enabled boolean DEFAULT true;
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS split_excluded_person_ids jsonb DEFAULT '[]'::jsonb;

-- Mark-paid / debt settlements
CREATE TABLE IF NOT EXISTS trip_settlements (
  id text PRIMARY KEY,
  from_person_id text,
  from_person_name text,
  to_person_id text,
  to_person_name text,
  amount_inr integer DEFAULT 0,
  note text,
  expense_id text,
  payment_method text DEFAULT 'unknown',
  created_at bigint,
  source text DEFAULT 'manual'
);

ALTER TABLE trip_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settlements" ON trip_settlements;
CREATE POLICY "anon_select_settlements" ON trip_settlements FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settlements" ON trip_settlements;
CREATE POLICY "anon_insert_settlements" ON trip_settlements FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settlements" ON trip_settlements;
CREATE POLICY "anon_update_settlements" ON trip_settlements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settlements" ON trip_settlements;
CREATE POLICY "anon_delete_settlements" ON trip_settlements FOR DELETE
  TO anon, authenticated USING (true);

-- Traveller profile photos
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

-- Live GPS points (optional; ignore error if unused)
CREATE TABLE IF NOT EXISTS trip_traveller_locations (
  person_id text PRIMARY KEY,
  person_name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m double precision,
  updated_at bigint,
  sharing boolean DEFAULT true
);
ALTER TABLE trip_traveller_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_locations" ON trip_traveller_locations;
CREATE POLICY "anon_select_locations" ON trip_traveller_locations FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_locations" ON trip_traveller_locations;
CREATE POLICY "anon_insert_locations" ON trip_traveller_locations FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_locations" ON trip_traveller_locations;
CREATE POLICY "anon_update_locations" ON trip_traveller_locations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_locations" ON trip_traveller_locations;
CREATE POLICY "anon_delete_locations" ON trip_traveller_locations FOR DELETE
  TO anon, authenticated USING (true);

-- Realtime (ignore errors if already added)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trip_settlements; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trip_traveller_profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trip_expenses; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trip_transfers; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trip_traveller_locations; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
