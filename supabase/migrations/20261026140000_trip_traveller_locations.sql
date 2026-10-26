-- Live traveller GPS points (battery-friendly client poll → upsert).
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
