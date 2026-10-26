-- Debt settlements: mark split shares as paid / cleared.
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
