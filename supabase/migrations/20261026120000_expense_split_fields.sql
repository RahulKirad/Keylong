-- Equal group split (Splitwise-style): on by default; excluded travellers skip this bill.
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS split_enabled boolean DEFAULT true;

ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS split_excluded_person_ids jsonb DEFAULT '[]'::jsonb;
