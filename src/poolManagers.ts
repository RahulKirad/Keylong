import {
  balanceReceived,
  balanceSpentFromPool,
  memberBalanceRemaining,
} from './expenseLedger';
import type { ExpenseRecord, FundTransfer, TripMember } from './expenseStore';

/** Default holders until the group edits them on the Expenses page. */
export const DEFAULT_POOL_MANAGER_NAMES = ['Rahul', 'Sanket'] as const;

const STORAGE_KEY = 'winter-himachal-pool-managers-v1';
const EVENT = 'pool-managers-updated';

export type PoolContribution = {
  fromPersonId: string;
  fromPersonName: string;
  amountInr: number;
  transferCount: number;
};

export type PoolSpend = {
  id: string;
  dateLabel: string;
  description: string;
  amountInr: number;
  paidByName: string;
};

export type PoolManagerSummary = {
  member: TripMember;
  slot: number;
  collectedInr: number;
  spentInr: number;
  remainingInr: number;
  contributions: PoolContribution[];
  spends: PoolSpend[];
};

function readStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).slice(0, 2);
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]): void {
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 2);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent(EVENT));
  window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
}

/** Seed from classic Rahul/Sanket names when nothing saved yet. */
function defaultIdsFromMembers(members: TripMember[]): string[] {
  return DEFAULT_POOL_MANAGER_NAMES.map(
    (name) => members.find((m) => m.name.trim().toLowerCase() === name.toLowerCase())?.id || '',
  ).filter(Boolean);
}

export function getPoolManagerIds(members: TripMember[] = []): string[] {
  const stored = readStoredIds();
  if (stored.length) {
    // Drop ids that no longer exist; keep order.
    const valid = stored.filter((id) => members.some((m) => m.id === id));
    if (valid.length) return valid;
  }
  return defaultIdsFromMembers(members);
}

export function setPoolManagerIds(ids: string[]): void {
  writeStoredIds(ids);
}

/** Replace one pool slot (0 or 1) with a traveller id. */
export function setPoolManagerSlot(slot: number, personId: string, members: TripMember[]): void {
  const current = getPoolManagerIds(members);
  const next = [...current];
  while (next.length < 2) next.push('');
  const index = slot === 1 ? 1 : 0;
  // Avoid duplicating the same person in both slots.
  const other = index === 0 ? 1 : 0;
  if (next[other] === personId) next[other] = '';
  next[index] = personId;
  writeStoredIds(next.filter(Boolean));
}

export function setPoolManagersFromServer(ids: string[]): void {
  const clean = [...new Set((ids || []).filter((id) => typeof id === 'string' && id.trim()))].slice(0, 2);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribePoolManagers(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function isPoolManagerName(name: string | undefined, members: TripMember[] = []): boolean {
  const n = (name || '').trim().toLowerCase();
  if (!n) return false;
  return findPoolManagers(members).some((m) => m.name.trim().toLowerCase() === n);
}

export function findPoolManagers(members: TripMember[]): TripMember[] {
  const ids = getPoolManagerIds(members);
  const found: TripMember[] = [];
  for (const id of ids) {
    const m = members.find((x) => x.id === id);
    if (m && !found.some((f) => f.id === m.id)) found.push(m);
  }
  if (found.length) return found;
  return defaultIdsFromMembers(members)
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is TripMember => Boolean(m));
}

function contributionsTo(
  memberId: string,
  transfers: FundTransfer[],
): PoolContribution[] {
  const map = new Map<string, PoolContribution>();
  for (const t of transfers) {
    if (t.toPersonId !== memberId) continue;
    const cur = map.get(t.fromPersonId);
    if (cur) {
      cur.amountInr += t.amountInr;
      cur.transferCount += 1;
    } else {
      map.set(t.fromPersonId, {
        fromPersonId: t.fromPersonId,
        fromPersonName: t.fromPersonName,
        amountInr: t.amountInr,
        transferCount: 1,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.amountInr - a.amountInr || a.fromPersonName.localeCompare(b.fromPersonName),
  );
}

function spendsFromPool(memberId: string, expenses: ExpenseRecord[]): PoolSpend[] {
  return expenses
    .filter((e) => e.spentFromBalance && (e.balanceHolderPersonId || e.paidByPersonId) === memberId)
    .map((e) => ({
      id: e.id,
      dateLabel: e.dateLabel,
      description: e.description,
      amountInr: e.amountInr,
      paidByName: e.paidByName,
    }))
    .sort((a, b) => b.amountInr - a.amountInr);
}

export function buildPoolManagerSummaries(
  members: TripMember[],
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): PoolManagerSummary[] {
  const managers = findPoolManagers(members);
  // Always expose two editable slots when possible (fill empty slots as placeholders via UI).
  return managers.map((member, slot) => ({
    member,
    slot,
    collectedInr: balanceReceived(member.id, transfers),
    spentInr: balanceSpentFromPool(member.id, expenses),
    remainingInr: memberBalanceRemaining(member.id, transfers, expenses),
    contributions: contributionsTo(member.id, transfers),
    spends: spendsFromPool(member.id, expenses),
  }));
}

/** Holders that still have float left to spend from. */
export function poolsWithRemaining(
  members: TripMember[],
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): PoolManagerSummary[] {
  return buildPoolManagerSummaries(members, transfers, expenses).filter((p) => p.remainingInr > 0);
}

/**
 * Pick which manager's pool to offer first when deducting a spend.
 * Prefer the payer if they are a manager with balance; else the larger remaining pool.
 */
export function preferredPoolForExpense(
  pools: PoolManagerSummary[],
  paidByPersonId: string,
): PoolManagerSummary | null {
  if (!pools.length) return null;
  const asPayer = pools.find((p) => p.member.id === paidByPersonId);
  if (asPayer) return asPayer;
  return [...pools].sort((a, b) => b.remainingInr - a.remainingInr)[0] || null;
}

/** Confirm dialog: deduct this spend from a shared pool? */
export function confirmDeductFromPool(opts: {
  amountInr: number;
  description: string;
  pools: PoolManagerSummary[];
  preferred: PoolManagerSummary;
}): PoolManagerSummary | null {
  const { amountInr, description, pools, preferred } = opts;
  const lines = pools
    .map(
      (p) =>
        `• ${p.member.name}: ₹${p.remainingInr.toLocaleString('en-IN')} left (collected ₹${p.collectedInr.toLocaleString('en-IN')})`,
    )
    .join('\n');
  const ok = window.confirm(
    `Minus ₹${amountInr.toLocaleString('en-IN')} for “${description || 'this spend'}” from the shared balance travellers gave previously?\n\n` +
      `${lines}\n\n` +
      `OK = yes, deduct from **${preferred.member.name}**'s pool\n` +
      `Cancel = no, keep as personal spend (not from pool)`,
  );
  if (!ok) return null;

  if (pools.length === 1) return preferred;

  const other = pools.find((p) => p.member.id !== preferred.member.id);
  if (!other) return preferred;

  const useOther = window.confirm(
    `Use **${preferred.member.name}**'s pool (₹${preferred.remainingInr.toLocaleString('en-IN')} left)?\n\n` +
      `OK = ${preferred.member.name}\n` +
      `Cancel = use ${other.member.name} instead (₹${other.remainingInr.toLocaleString('en-IN')} left)`,
  );
  return useOther ? preferred : other;
}
