-- Whether an expense amount counts toward group / member totals.
ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS count_in_total boolean DEFAULT true;
