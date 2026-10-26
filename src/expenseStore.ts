import { getDays } from './itineraryStore';
import type { Day } from './tripData';
import { memberBalanceRemaining } from './expenseLedger';
import { DEFAULT_TRAVELLER_NAMES } from './defaultTravellers';
import { registerTravellerSeeder } from './travellerSeed';
import { collapseMembers, remapId, stableMemberId } from './memberIdentity';

export const EXPENSE_STORAGE_KEY = 'winter-himachal-expenses-v1';

export type TripMember = { id: string; name: string };

export type PaymentMethod = 'cash' | 'online' | 'unknown';

export type ExpenseRecord = {
  id: string;
  tripDate: string;
  dateLabel: string;
  description: string;
  category: string;
  amountInr: number;
  paidByPersonId: string;
  paidByName: string;
  paymentMethod: PaymentMethod;
  /** Deducted from holder's pool (money others gave them). */
  spentFromBalance: boolean;
  balanceHolderPersonId?: string;
  balanceHolderName?: string;
  /** Who originally handed cash to the holder (optional note from chat). */
  givenByPersonId?: string;
  givenByName?: string;
  /** When false, amount is logged but excluded from group / member totals. */
  countInTotal: boolean;
  /** When true (default), amount is split equally among travellers not in splitExcludedPersonIds. */
  splitEnabled: boolean;
  /** Travellers excluded from this expense’s equal split (e.g. not present for that meal). */
  splitExcludedPersonIds: string[];
  createdAt: number;
  updatedAt: number;
  source: 'manual' | 'voice' | 'ai' | 'offline';
};

export type FundTransfer = {
  id: string;
  tripDate: string;
  dateLabel: string;
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountInr: number;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: number;
  source: ExpenseRecord['source'];
};

export type PendingExpenseUtterance = {
  id: string;
  rawText: string;
  createdAt: number;
};

/** Someone paid back what they owed on splits (clears pending debt). */
export type DebtSettlement = {
  id: string;
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountInr: number;
  note?: string;
  expenseId?: string;
  paymentMethod: PaymentMethod;
  createdAt: number;
  source: ExpenseRecord['source'];
};

export type ExpenseStoreState = {
  members: TripMember[];
  expenses: ExpenseRecord[];
  transfers: FundTransfer[];
  settlements: DebtSettlement[];
  pending: PendingExpenseUtterance[];
};

function dateFromDayRecord(d: Day): { tripDate: string; dateLabel: string } {
  const jan = d.date.match(/(\d{1,2})\s*Jan/i);
  if (jan) {
    const day = jan[1].padStart(2, '0');
    return { tripDate: `2027-01-${day}`, dateLabel: `${parseInt(jan[1], 10)} Jan` };
  }
  const dec = d.date.match(/(\d{1,2})\s*Dec/i);
  if (dec) {
    const day = dec[1].padStart(2, '0');
    return { tripDate: `2026-12-${day}`, dateLabel: `${parseInt(dec[1], 10)} Dec` };
  }
  return { tripDate: '2026-12-25', dateLabel: d.date };
}

function newId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState(): ExpenseStoreState {
  return { members: [], expenses: [], transfers: [], settlements: [], pending: [] };
}

function normalizeExpense(e: ExpenseRecord): ExpenseRecord {
  return {
    ...e,
    paymentMethod: e.paymentMethod || 'unknown',
    spentFromBalance: Boolean(e.spentFromBalance),
    countInTotal: e.countInTotal !== false,
    splitEnabled: e.splitEnabled !== false,
    splitExcludedPersonIds: Array.isArray(e.splitExcludedPersonIds)
      ? e.splitExcludedPersonIds.filter(Boolean)
      : [],
  };
}

/** One record per name, and point expenses and transfers at the record that is kept. */
export function dedupeExpenseState(input: ExpenseStoreState): ExpenseStoreState {
  const { members, remap } = collapseMembers(input.members || []);
  const idOf = (id?: string) => remapId(id, remap);
  return {
    ...input,
    members,
    expenses: (input.expenses || []).map((expense) => {
      const normalized = normalizeExpense(expense);
      return {
        ...normalized,
        paidByPersonId: idOf(expense.paidByPersonId) || expense.paidByPersonId,
        balanceHolderPersonId: idOf(expense.balanceHolderPersonId),
        givenByPersonId: idOf(expense.givenByPersonId),
        splitExcludedPersonIds: normalized.splitExcludedPersonIds
          .map((id) => idOf(id) || id)
          .filter(Boolean),
      };
    }),
    transfers: (input.transfers || []).map((transfer) => ({
      ...transfer,
      fromPersonId: idOf(transfer.fromPersonId) || transfer.fromPersonId,
      toPersonId: idOf(transfer.toPersonId) || transfer.toPersonId,
    })),
    settlements: (input.settlements || []).map((settlement) => ({
      ...settlement,
      fromPersonId: idOf(settlement.fromPersonId) || settlement.fromPersonId,
      toPersonId: idOf(settlement.toPersonId) || settlement.toPersonId,
      amountInr: Math.max(0, Math.round(settlement.amountInr || 0)),
      paymentMethod: settlement.paymentMethod || 'unknown',
    })),
  };
}

function load(): ExpenseStoreState {
  try {
    const raw = localStorage.getItem(EXPENSE_STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as ExpenseStoreState;
    return dedupeExpenseState({
      members: parsed.members || [],
      expenses: (parsed.expenses || []).map(normalizeExpense),
      transfers: parsed.transfers || [],
      settlements: parsed.settlements || [],
      pending: parsed.pending || [],
    });
  } catch {
    return defaultState();
  }
}

function save(state: ExpenseStoreState): void {
  localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('expenses-updated'));
  window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
}

let state = load();

export function setExpenseStateFromServer(serverState: ExpenseStoreState): void {
  state = dedupeExpenseState({
    members: serverState.members || [],
    expenses: (serverState.expenses || []).map(normalizeExpense),
    transfers: serverState.transfers || [],
    settlements: serverState.settlements || state.settlements || [],
    pending: state.pending || [],
  });
  localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('expenses-updated'));
}

function seedDefaultTravellersIfNeeded(): void {
  let next = dedupeExpenseState(state);
  let changed =
    next.members.length !== state.members.length ||
    next.members.some((member, index) => member.id !== state.members[index]?.id);
  for (const name of DEFAULT_TRAVELLER_NAMES) {
    if (next.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) continue;
    next = { ...next, members: [...next.members, { id: stableMemberId(name), name }] };
    changed = true;
  }
  state = next;
  if (changed) save(state);
}

registerTravellerSeeder(seedDefaultTravellersIfNeeded);
seedDefaultTravellersIfNeeded();

export function getExpenseState(): ExpenseStoreState {
  return state;
}

export function subscribeExpenses(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('expenses-updated', handler);
  return () => window.removeEventListener('expenses-updated', handler);
}

export function resolveTripDate(dayNum: number): { tripDate: string; dateLabel: string } {
  const d = getDays().find((day) => day.day === dayNum);
  if (d) return dateFromDayRecord(d);
  return { tripDate: '2026-12-25', dateLabel: '25 Dec' };
}

export function parseDateFromText(text: string): { tripDate: string; dateLabel: string } | null {
  const lower = text.toLowerCase();
  const dayRef = lower.match(/\bday\s*(\d{1,2})\b/);
  if (dayRef) return resolveTripDate(parseInt(dayRef[1], 10));

  for (const d of getDays()) {
    const dec = d.date.match(/(\d{1,2})\s*Dec/i);
    if (dec && lower.includes(`${dec[1]} dec`)) return dateFromDayRecord(d);
    const jan = d.date.match(/(\d{1,2})\s*Jan/i);
    if (jan && lower.includes(`${jan[1]} jan`)) return dateFromDayRecord(d);
  }

  const dayMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(dec|december|jan|january)\b/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    const isJan = dayMatch[2].startsWith('jan');
    if (isJan) return { tripDate: `2027-01-${String(day).padStart(2, '0')}`, dateLabel: `${day} Jan` };
    return { tripDate: `2026-12-${String(day).padStart(2, '0')}`, dateLabel: `${day} Dec` };
  }
  return null;
}

export function addMember(name: string): TripMember | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = state.members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  if (state.members.length >= 10) return null;
  const member: TripMember = { id: stableMemberId(trimmed), name: trimmed };
  state = { ...state, members: [...state.members, member] };
  save(state);
  return member;
}

export async function removeMember(id: string): Promise<void> {
  state = { ...state, members: state.members.filter((m) => m.id !== id) };
  save(state);
  try {
    const { supabase, supabaseConfigured } = await import('./supabaseClient');
    if (!supabaseConfigured) return;
    await supabase.from('trip_members').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete member from cloud:', e);
  }
}

export function findMemberByName(name: string): TripMember | undefined {
  const n = name.trim().toLowerCase();
  return state.members.find((m) => m.name.toLowerCase() === n);
}

export type ExpenseInput = {
  tripDate: string;
  dateLabel: string;
  description: string;
  category: string;
  amountInr: number;
  paidByPersonId: string;
  paidByName: string;
  paymentMethod: PaymentMethod;
  spentFromBalance: boolean;
  balanceHolderPersonId?: string;
  balanceHolderName?: string;
  givenByPersonId?: string;
  givenByName?: string;
  countInTotal?: boolean;
  splitEnabled?: boolean;
  splitExcludedPersonIds?: string[];
  source: ExpenseRecord['source'];
};

export type FundTransferInput = {
  tripDate: string;
  dateLabel: string;
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountInr: number;
  paymentMethod: PaymentMethod;
  note?: string;
  source: FundTransfer['source'];
};

function assertSufficientBalance(input: ExpenseInput): void {
  if (!input.spentFromBalance) return;
  const holderId = input.balanceHolderPersonId || input.paidByPersonId;
  const remaining = memberBalanceRemaining(holderId, state.transfers, state.expenses);
  const amount = Math.max(0, Math.round(input.amountInr));
  if (amount > remaining) {
    const holder =
      state.members.find((m) => m.id === holderId)?.name || input.balanceHolderName || input.paidByName;
    throw new Error(
      `Not enough balance for ${holder} (₹${remaining.toLocaleString('en-IN')} left). Log money given first, e.g. “Rahul gave 5000 to ${holder} cash”.`,
    );
  }
}

export function addExpense(input: ExpenseInput): ExpenseRecord {
  assertSufficientBalance(input);
  const now = Date.now();
  const holderId = input.spentFromBalance ? input.balanceHolderPersonId || input.paidByPersonId : undefined;
  const holder = holderId ? state.members.find((m) => m.id === holderId) : undefined;
  const record: ExpenseRecord = {
    id: newId(),
    ...input,
    amountInr: Math.max(0, Math.round(input.amountInr)),
    paymentMethod: input.paymentMethod || 'unknown',
    spentFromBalance: Boolean(input.spentFromBalance),
    countInTotal: input.countInTotal !== false,
    splitEnabled: input.splitEnabled !== false,
    splitExcludedPersonIds: (input.splitExcludedPersonIds || []).filter(Boolean),
    balanceHolderPersonId: holderId,
    balanceHolderName: holder?.name || input.balanceHolderName,
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, expenses: [...state.expenses, record].sort((a, b) => a.tripDate.localeCompare(b.tripDate)) };
  save(state);
  return record;
}

export function updateExpense(id: string, patch: Partial<ExpenseInput>): void {
  const existing = state.expenses.find((e) => e.id === id);
  if (!existing) return;
  const merged: ExpenseInput = {
    tripDate: patch.tripDate ?? existing.tripDate,
    dateLabel: patch.dateLabel ?? existing.dateLabel,
    description: patch.description ?? existing.description,
    category: patch.category ?? existing.category,
    amountInr: patch.amountInr !== undefined ? patch.amountInr : existing.amountInr,
    paidByPersonId: patch.paidByPersonId ?? existing.paidByPersonId,
    paidByName: patch.paidByName ?? existing.paidByName,
    paymentMethod: patch.paymentMethod ?? existing.paymentMethod,
    spentFromBalance: patch.spentFromBalance !== undefined ? patch.spentFromBalance : existing.spentFromBalance,
    balanceHolderPersonId: patch.balanceHolderPersonId ?? existing.balanceHolderPersonId,
    balanceHolderName: patch.balanceHolderName ?? existing.balanceHolderName,
    givenByPersonId: patch.givenByPersonId ?? existing.givenByPersonId,
    givenByName: patch.givenByName ?? existing.givenByName,
    countInTotal: patch.countInTotal !== undefined ? patch.countInTotal : existing.countInTotal !== false,
    splitEnabled: patch.splitEnabled !== undefined ? patch.splitEnabled : existing.splitEnabled !== false,
    splitExcludedPersonIds:
      patch.splitExcludedPersonIds !== undefined
        ? patch.splitExcludedPersonIds.filter(Boolean)
        : existing.splitExcludedPersonIds || [],
    source: patch.source ?? existing.source,
  };
  const others = state.expenses.filter((e) => e.id !== id);
  assertSufficientBalanceForState(merged, id, others);
  state = {
    ...state,
    expenses: state.expenses.map((e) =>
      e.id === id
        ? {
            ...e,
            ...merged,
            amountInr: Math.max(0, Math.round(merged.amountInr)),
            updatedAt: Date.now(),
          }
        : e,
    ),
  };
  save(state);
}

function assertSufficientBalanceForState(input: ExpenseInput, editingId: string, otherExpenses: ExpenseRecord[]): void {
  if (!input.spentFromBalance) return;
  const holderId = input.balanceHolderPersonId || input.paidByPersonId;
  const spentOthers = otherExpenses
    .filter((e) => e.spentFromBalance && (e.balanceHolderPersonId || e.paidByPersonId) === holderId)
    .reduce((s, e) => s + e.amountInr, 0);
  const received = state.transfers.filter((t) => t.toPersonId === holderId).reduce((s, t) => s + t.amountInr, 0);
  const remaining = received - spentOthers;
  const amount = Math.max(0, Math.round(input.amountInr));
  if (amount > remaining) {
    const holder = state.members.find((m) => m.id === holderId)?.name || input.paidByName;
    throw new Error(`Not enough balance for ${holder} (₹${remaining.toLocaleString('en-IN')} left).`);
  }
}

export async function deleteExpense(id: string): Promise<void> {
  state = { ...state, expenses: state.expenses.filter((e) => e.id !== id) };
  save(state);
  try {
    const { supabase, supabaseConfigured } = await import('./supabaseClient');
    if (!supabaseConfigured) return;
    await supabase.from('trip_expenses').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete expense from cloud:', e);
  }
}

export function addFundTransfer(input: FundTransferInput): FundTransfer {
  const now = Date.now();
  const record: FundTransfer = {
    id: newId(),
    ...input,
    amountInr: Math.max(0, Math.round(input.amountInr)),
    paymentMethod: input.paymentMethod || 'unknown',
    createdAt: now,
  };
  state = { ...state, transfers: [...state.transfers, record].sort((a, b) => a.tripDate.localeCompare(b.tripDate)) };
  save(state);
  return record;
}

export type DebtSettlementInput = {
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountInr: number;
  note?: string;
  expenseId?: string;
  paymentMethod?: PaymentMethod;
  source: DebtSettlement['source'];
};

export function addDebtSettlement(input: DebtSettlementInput): DebtSettlement {
  const amount = Math.max(0, Math.round(input.amountInr));
  if (amount <= 0) throw new Error('Settlement amount must be greater than zero.');
  if (input.fromPersonId === input.toPersonId) {
    throw new Error('Cannot settle a debt to yourself.');
  }
  const record: DebtSettlement = {
    id: newId(),
    fromPersonId: input.fromPersonId,
    fromPersonName: input.fromPersonName,
    toPersonId: input.toPersonId,
    toPersonName: input.toPersonName,
    amountInr: amount,
    note: input.note?.trim() || undefined,
    expenseId: input.expenseId,
    paymentMethod: input.paymentMethod || 'unknown',
    createdAt: Date.now(),
    source: input.source,
  };
  state = { ...state, settlements: [...(state.settlements || []), record] };
  save(state);
  return record;
}

export async function deleteDebtSettlement(id: string): Promise<void> {
  state = { ...state, settlements: (state.settlements || []).filter((s) => s.id !== id) };
  save(state);
  // Cloud copy lives in trip_budget blob — pushSync overwrites the full list.
  window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
}

export async function deleteFundTransfer(id: string): Promise<void> {
  state = { ...state, transfers: state.transfers.filter((t) => t.id !== id) };
  save(state);
  try {
    const { supabase, supabaseConfigured } = await import('./supabaseClient');
    if (!supabaseConfigured) return;
    await supabase.from('trip_transfers').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete transfer from cloud:', e);
  }
}

export function queuePendingUtterance(rawText: string): PendingExpenseUtterance {
  const item: PendingExpenseUtterance = { id: newId(), rawText, createdAt: Date.now() };
  state = { ...state, pending: [...state.pending, item] };
  save(state);
  return item;
}

export function removePending(id: string): void {
  state = { ...state, pending: state.pending.filter((p) => p.id !== id) };
  save(state);
}

export function expenseCountsInTotal(e: ExpenseRecord): boolean {
  return e.countInTotal !== false;
}

export function totalsByMember(): { member: TripMember; total: number }[] {
  const map = new Map<string, number>();
  for (const m of state.members) map.set(m.id, 0);
  for (const e of state.expenses) {
    if (!expenseCountsInTotal(e)) continue;
    map.set(e.paidByPersonId, (map.get(e.paidByPersonId) || 0) + e.amountInr);
  }
  return state.members.map((m) => ({ member: m, total: map.get(m.id) || 0 }));
}

export function grandTotal(): number {
  return state.expenses.filter(expenseCountsInTotal).reduce((s, e) => s + e.amountInr, 0);
}

export function setExpenseCountInTotal(id: string, countInTotal: boolean): void {
  const existing = state.expenses.find((e) => e.id === id);
  if (!existing) return;
  updateExpense(id, { countInTotal });
}

export function setExpenseSplitEnabled(id: string, splitEnabled: boolean): void {
  const existing = state.expenses.find((e) => e.id === id);
  if (!existing) return;
  updateExpense(id, { splitEnabled });
}

export function setExpenseSplitExcluded(id: string, splitExcludedPersonIds: string[]): void {
  const existing = state.expenses.find((e) => e.id === id);
  if (!existing) return;
  updateExpense(id, { splitExcludedPersonIds });
}

export function exportExpensesCsv(): string {
  const header =
    'Date,Description,Category,Amount (INR),Paid by,Payment,From balance,Balance holder,Given by,Count in total,Split,Excluded';
  const rows = state.expenses.map((e) => {
    const holder = e.spentFromBalance ? e.balanceHolderName || e.paidByName : '';
    const givenBy = e.givenByName || '';
    const excluded = (e.splitExcludedPersonIds || [])
      .map((id) => state.members.find((m) => m.id === id)?.name || id)
      .join('; ');
    return `"${e.dateLabel}","${e.description.replace(/"/g, '""')}","${e.category}",${e.amountInr},"${e.paidByName}","${e.paymentMethod}",${e.spentFromBalance ? 'yes' : 'no'},"${holder}","${givenBy}",${expenseCountsInTotal(e) ? 'yes' : 'no'},${e.splitEnabled !== false ? 'yes' : 'no'},"${excluded.replace(/"/g, '""')}"`;
  });
  const transferHeader = '\n\nTransfers\nDate,From,To,Amount (INR),Payment,Note';
  const transferRows = state.transfers.map(
    (t) =>
      `"${t.dateLabel}","${t.fromPersonName}","${t.toPersonName}",${t.amountInr},"${t.paymentMethod}","${(t.note || '').replace(/"/g, '""')}"`,
  );
  return [header, ...rows, transferHeader, ...transferRows].join('\n');
}
