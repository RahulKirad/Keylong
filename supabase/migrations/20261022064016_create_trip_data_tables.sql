/*
# Create shared trip data tables (single-tenant, no auth)

1. New Tables
- `trip_members` — travellers in the group (id text PK, name text)
- `trip_expenses` — expense records with payer, amount, category, balance tracking
- `trip_transfers` — fund transfers between members
- `trip_assignments` — task assignments for travellers
- `trip_budget` — single-row budget calculator state (categories, travelers, trip target)
2. Security
- Enable RLS on all tables.
- Allow anon + authenticated CRUD because this is a shared group trip planner with no sign-in.
- All data is intentionally public/shared across all devices.
*/

CREATE TABLE IF NOT EXISTS trip_members (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id text PRIMARY KEY,
  trip_date text,
  date_label text,
  description text,
  category text,
  amount_inr integer DEFAULT 0,
  paid_by_person_id text,
  paid_by_name text,
  payment_method text DEFAULT 'unknown',
  spent_from_balance boolean DEFAULT false,
  balance_holder_person_id text,
  balance_holder_name text,
  given_by_person_id text,
  given_by_name text,
  created_at bigint,
  updated_at bigint,
  source text DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS trip_transfers (
  id text PRIMARY KEY,
  trip_date text,
  date_label text,
  from_person_id text,
  from_person_name text,
  to_person_id text,
  to_person_name text,
  amount_inr integer DEFAULT 0,
  payment_method text DEFAULT 'unknown',
  note text,
  created_at bigint,
  source text DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS trip_assignments (
  id text PRIMARY KEY,
  assignee_person_id text,
  assignee_name text,
  task text,
  trip_day_number integer,
  date_label text,
  created_at bigint,
  updated_at bigint,
  source text DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS trip_budget (
  id text PRIMARY KEY DEFAULT 'singleton',
  categories jsonb,
  travelers integer DEFAULT 2,
  trip_target integer DEFAULT 0,
  updated_at bigint
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_budget ENABLE ROW LEVEL SECURITY;

-- trip_members policies
DROP POLICY IF EXISTS "anon_select_members" ON trip_members;
CREATE POLICY "anon_select_members" ON trip_members FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_members" ON trip_members;
CREATE POLICY "anon_insert_members" ON trip_members FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_members" ON trip_members;
CREATE POLICY "anon_update_members" ON trip_members FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_members" ON trip_members;
CREATE POLICY "anon_delete_members" ON trip_members FOR DELETE
  TO anon, authenticated USING (true);

-- trip_expenses policies
DROP POLICY IF EXISTS "anon_select_expenses" ON trip_expenses;
CREATE POLICY "anon_select_expenses" ON trip_expenses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_expenses" ON trip_expenses;
CREATE POLICY "anon_insert_expenses" ON trip_expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_expenses" ON trip_expenses;
CREATE POLICY "anon_update_expenses" ON trip_expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_expenses" ON trip_expenses;
CREATE POLICY "anon_delete_expenses" ON trip_expenses FOR DELETE
  TO anon, authenticated USING (true);

-- trip_transfers policies
DROP POLICY IF EXISTS "anon_select_transfers" ON trip_transfers;
CREATE POLICY "anon_select_transfers" ON trip_transfers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transfers" ON trip_transfers;
CREATE POLICY "anon_insert_transfers" ON trip_transfers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transfers" ON trip_transfers;
CREATE POLICY "anon_update_transfers" ON trip_transfers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transfers" ON trip_transfers;
CREATE POLICY "anon_delete_transfers" ON trip_transfers FOR DELETE
  TO anon, authenticated USING (true);

-- trip_assignments policies
DROP POLICY IF EXISTS "anon_select_assignments" ON trip_assignments;
CREATE POLICY "anon_select_assignments" ON trip_assignments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_assignments" ON trip_assignments;
CREATE POLICY "anon_insert_assignments" ON trip_assignments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_assignments" ON trip_assignments;
CREATE POLICY "anon_update_assignments" ON trip_assignments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_assignments" ON trip_assignments;
CREATE POLICY "anon_delete_assignments" ON trip_assignments FOR DELETE
  TO anon, authenticated USING (true);

-- trip_budget policies
DROP POLICY IF EXISTS "anon_select_budget" ON trip_budget;
CREATE POLICY "anon_select_budget" ON trip_budget FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_budget" ON trip_budget;
CREATE POLICY "anon_insert_budget" ON trip_budget FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_budget" ON trip_budget;
CREATE POLICY "anon_update_budget" ON trip_budget FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_budget" ON trip_budget;
CREATE POLICY "anon_delete_budget" ON trip_budget FOR DELETE
  TO anon, authenticated USING (true);
