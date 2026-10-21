import { days } from './tripData';

export const EXPENSE_STORAGE_KEY = 'winter-himachal-expenses-v1';

export type TripMember = { id: string; name: string };

export type ExpenseRecord = {
  id: string;
  tripDate: string;
  dateLabel: string;
  description: string;
  category: string;
  amountInr: number;
  paidByPersonId: string;
  paidByName: string;
  createdAt: number;
  updatedAt: number;
  source: 'manual' | 'voice' | 'ai' | 'offline';
};

export type PendingExpenseUtterance = {
  id: string;
  rawText: string;
  createdAt: number;
};

export type ExpenseStoreState = {
  members: TripMember[];
  expenses: ExpenseRecord[];
  pending: PendingExpenseUtterance[];
};

const dayByNumber = new Map(days.map((d) => [d.day, d]));

function dateFromDayRecord(d: (typeof days)[0]): { tripDate: string; dateLabel: string } {
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
  return { members: [], expenses: [], pending: [] };
}

function load(): ExpenseStoreState {
  try {
    const raw = localStorage.getItem(EXPENSE_STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as ExpenseStoreState;
    return {
      members: parsed.members || [],
      expenses: parsed.expenses || [],
      pending: parsed.pending || [],
    };
  } catch {
    return defaultState();
  }
}

function save(state: ExpenseStoreState): void {
  localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('expenses-updated'));
}

let state = load();

export function getExpenseState(): ExpenseStoreState {
  return state;
}

export function subscribeExpenses(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('expenses-updated', handler);
  return () => window.removeEventListener('expenses-updated', handler);
}

export function resolveTripDate(dayNum: number): { tripDate: string; dateLabel: string } {
  const d = dayByNumber.get(dayNum);
  if (d) return dateFromDayRecord(d);
  return { tripDate: '2026-12-25', dateLabel: '25 Dec' };
}

export function parseDateFromText(text: string): { tripDate: string; dateLabel: string } | null {
  const lower = text.toLowerCase();
  const dayRef = lower.match(/\bday\s*(\d{1,2})\b/);
  if (dayRef) return resolveTripDate(parseInt(dayRef[1], 10));

  for (const d of days) {
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
  if (!trimmed || state.members.length >= 10) return null;
  if (state.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
    return state.members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase())!;
  }
  const member: TripMember = { id: newId(), name: trimmed };
  state = { ...state, members: [...state.members, member] };
  save(state);
  return member;
}

export function removeMember(id: string): void {
  state = { ...state, members: state.members.filter((m) => m.id !== id) };
  save(state);
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
  source: ExpenseRecord['source'];
};

export function addExpense(input: ExpenseInput): ExpenseRecord {
  const now = Date.now();
  const record: ExpenseRecord = {
    id: newId(),
    ...input,
    amountInr: Math.max(0, Math.round(input.amountInr)),
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, expenses: [...state.expenses, record].sort((a, b) => a.tripDate.localeCompare(b.tripDate)) };
  save(state);
  return record;
}

export function updateExpense(id: string, patch: Partial<ExpenseInput>): void {
  state = {
    ...state,
    expenses: state.expenses.map((e) =>
      e.id === id
        ? {
            ...e,
            ...patch,
            amountInr: patch.amountInr !== undefined ? Math.max(0, Math.round(patch.amountInr)) : e.amountInr,
            updatedAt: Date.now(),
          }
        : e,
    ),
  };
  save(state);
}

export function deleteExpense(id: string): void {
  state = { ...state, expenses: state.expenses.filter((e) => e.id !== id) };
  save(state);
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

export function totalsByMember(): { member: TripMember; total: number }[] {
  const map = new Map<string, number>();
  for (const m of state.members) map.set(m.id, 0);
  for (const e of state.expenses) {
    map.set(e.paidByPersonId, (map.get(e.paidByPersonId) || 0) + e.amountInr);
  }
  return state.members.map((m) => ({ member: m, total: map.get(m.id) || 0 }));
}

export function grandTotal(): number {
  return state.expenses.reduce((s, e) => s + e.amountInr, 0);
}

export function exportExpensesCsv(): string {
  const header = 'Date,Description,Category,Amount (INR),Paid by';
  const rows = state.expenses.map(
    (e) =>
      `"${e.dateLabel}","${e.description.replace(/"/g, '""')}","${e.category}",${e.amountInr},"${e.paidByName}"`,
  );
  return [header, ...rows].join('\n');
}
