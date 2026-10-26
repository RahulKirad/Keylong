import type { DebtSettlement, ExpenseRecord, TripMember } from './expenseStore';
import { stableMemberId } from './memberIdentity';

function countsInTotal(e: ExpenseRecord): boolean {
  return e.countInTotal !== false;
}

function normName(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

/** Prefer paidByName so a stale / duplicated person id cannot mark the wrong traveller as payer. */
export function isExpensePayer(member: TripMember, expense: ExpenseRecord): boolean {
  const paidName = normName(expense.paidByName);
  if (paidName) return normName(member.name) === paidName;
  if (!expense.paidByPersonId) return false;
  return (
    member.id === expense.paidByPersonId || stableMemberId(member.name) === expense.paidByPersonId
  );
}

function findExpensePayer(expense: ExpenseRecord, members: TripMember[]): TripMember | undefined {
  const paidName = normName(expense.paidByName);
  if (paidName) {
    const byName = members.find((m) => normName(m.name) === paidName);
    if (byName) return byName;
  }
  if (!expense.paidByPersonId) return undefined;
  return (
    members.find((m) => m.id === expense.paidByPersonId) ||
    members.find((m) => stableMemberId(m.name) === expense.paidByPersonId)
  );
}

function memberIsExcluded(member: TripMember, excludedIds: Set<string>): boolean {
  if (excludedIds.has(member.id)) return true;
  if (excludedIds.has(stableMemberId(member.name))) return true;
  const slug = normName(member.name).replace(/[^a-z0-9]+/g, '-');
  if (!slug) return false;
  for (const id of excludedIds) {
    const key = id.toLowerCase();
    if (key === `member-${slug}` || key.endsWith(`-${slug}`) || key.includes(`-${slug}-`)) {
      return true;
    }
  }
  return false;
}

export type SplitShareRow = {
  member: TripMember;
  shareInr: number;
  role: 'payer' | 'owes';
};

export type ExpenseSplitDetail = {
  expense: ExpenseRecord;
  participants: TripMember[];
  excluded: TripMember[];
  shareInr: number;
  shares: SplitShareRow[];
  /** Non-payers who owe the payer their share. */
  owesToPayer: { member: TripMember; amountInr: number }[];
};

export type NetBalanceRow = {
  member: TripMember;
  /** Positive = others owe them; negative = they owe others. */
  netInr: number;
};

export type SettlePayment = {
  from: TripMember;
  to: TripMember;
  amountInr: number;
};

function excludedSet(expense: ExpenseRecord): Set<string> {
  return new Set((expense.splitExcludedPersonIds || []).filter(Boolean));
}

/** Whether this expense participates in equal group splits. Defaults to on. */
export function expenseIsSplit(expense: ExpenseRecord): boolean {
  return expense.splitEnabled !== false && countsInTotal(expense);
}

export function participantsForExpense(
  expense: ExpenseRecord,
  members: TripMember[],
): { participants: TripMember[]; excluded: TripMember[] } {
  const excludedIds = excludedSet(expense);
  const participants = members.filter((m) => !memberIsExcluded(m, excludedIds));
  const excluded = members.filter((m) => memberIsExcluded(m, excludedIds));
  // Payer must stay in the split so their share is accounted for.
  const payer = findExpensePayer(expense, members);
  if (payer && participants.every((m) => !isExpensePayer(m, expense))) {
    return {
      participants: [...participants, payer],
      excluded: excluded.filter((m) => !isExpensePayer(m, expense)),
    };
  }
  return { participants, excluded };
}

/** Equal whole-rupee shares; remainder rupees go to the payer's share first. */
export function equalSharesInr(amountInr: number, participantCount: number, payerIndex: number): number[] {
  const n = Math.max(1, participantCount);
  const amount = Math.max(0, Math.round(amountInr));
  const base = Math.floor(amount / n);
  const rem = amount - base * n;
  const shares = Array.from({ length: n }, () => base);
  // Distribute remainder starting at payer so payer absorbs rounding first.
  for (let i = 0; i < rem; i += 1) {
    shares[(payerIndex + i) % n] += 1;
  }
  return shares;
}

export function buildExpenseSplitDetail(
  expense: ExpenseRecord,
  members: TripMember[],
): ExpenseSplitDetail | null {
  if (!expenseIsSplit(expense) || expense.amountInr <= 0) return null;
  const { participants, excluded } = participantsForExpense(expense, members);
  if (participants.length === 0) return null;

  const payerIndex = Math.max(
    0,
    participants.findIndex((m) => isExpensePayer(m, expense)),
  );
  const shareAmounts = equalSharesInr(expense.amountInr, participants.length, payerIndex);
  const shares: SplitShareRow[] = participants.map((member, i) => ({
    member,
    shareInr: shareAmounts[i],
    role: isExpensePayer(member, expense) ? 'payer' : 'owes',
  }));
  const owesToPayer = shares
    .filter((s) => s.role === 'owes' && s.shareInr > 0)
    .map((s) => ({ member: s.member, amountInr: s.shareInr }));

  return {
    expense,
    participants,
    excluded,
    shareInr: shareAmounts[0] ?? 0,
    shares,
    owesToPayer,
  };
}

export function buildAllExpenseSplits(
  expenses: ExpenseRecord[],
  members: TripMember[],
): ExpenseSplitDetail[] {
  return expenses
    .map((e) => buildExpenseSplitDetail(e, members))
    .filter((d): d is ExpenseSplitDetail => Boolean(d));
}

/** Net position from splits only: + means should receive, − means should pay. */
export function buildNetBalances(
  expenses: ExpenseRecord[],
  members: TripMember[],
  settlements: DebtSettlement[] = [],
): NetBalanceRow[] {
  const net = new Map<string, number>();
  for (const m of members) net.set(m.id, 0);

  for (const detail of buildAllExpenseSplits(expenses, members)) {
    const payer = findExpensePayer(detail.expense, members);
    const payerId = payer?.id || detail.expense.paidByPersonId;
    for (const share of detail.shares) {
      if (isExpensePayer(share.member, detail.expense)) {
        // Payer laid out full amount; their own share is their cost.
        net.set(payerId, (net.get(payerId) || 0) + (detail.expense.amountInr - share.shareInr));
      } else {
        net.set(share.member.id, (net.get(share.member.id) || 0) - share.shareInr);
      }
    }
  }

  // Settlements: debtor paid creditor → move nets toward zero.
  for (const s of settlements) {
    net.set(s.fromPersonId, (net.get(s.fromPersonId) || 0) + s.amountInr);
    net.set(s.toPersonId, (net.get(s.toPersonId) || 0) - s.amountInr);
  }

  return members.map((member) => ({
    member,
    netInr: Math.round(net.get(member.id) || 0),
  }));
}

/** Greedy settle-up: fewest payments from debtors to creditors. */
export function simplifySettlements(balances: NetBalanceRow[]): SettlePayment[] {
  const debtors = balances
    .filter((b) => b.netInr < -0.5)
    .map((b) => ({ member: b.member, amount: -b.netInr }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.netInr > 0.5)
    .map((b) => ({ member: b.member, amount: b.netInr }))
    .sort((a, b) => b.amount - a.amount);

  const payments: SettlePayment[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay >= 1) {
      payments.push({
        from: debtors[i].member,
        to: creditors[j].member,
        amountInr: Math.round(pay),
      });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.5) i += 1;
    if (creditors[j].amount < 0.5) j += 1;
  }
  return payments;
}

export function formatSplitParticipants(detail: ExpenseSplitDetail): string {
  const n = detail.participants.length;
  const excl = detail.excluded.length;
  if (excl === 0) return `All ${n}`;
  return `${n} of ${n + excl}`;
}

export type SummedPairDebt = {
  from: TripMember;
  to: TripMember;
  amountInr: number;
  /** Per-expense bits that rolled into this sum. */
  parts: { description: string; dateLabel: string; amountInr: number; expenseId?: string }[];
};

export type ReceiveSummary = {
  member: TripMember;
  /** Total others owe them across all split bills (before settle simplify). */
  totalToReceiveInr: number;
  fromDebtors: { member: TripMember; amountInr: number }[];
};

export type PaySummary = {
  member: TripMember;
  totalToPayInr: number;
  toCreditors: { member: TripMember; amountInr: number }[];
};

/** Gross shares owed across expenses (before settlements). */
export function buildGrossPairDebts(
  expenses: ExpenseRecord[],
  members: TripMember[],
): SummedPairDebt[] {
  const map = new Map<string, SummedPairDebt>();
  for (const detail of buildAllExpenseSplits(expenses, members)) {
    const payer = findExpensePayer(detail.expense, members);
    if (!payer) continue;
    for (const owe of detail.owesToPayer) {
      // Skip only the real payer (by name). Duplicate hosted ids must not drop another traveller.
      if (isExpensePayer(owe.member, detail.expense)) continue;
      // Key by name so two people who briefly shared an id never collapse into one debt.
      const key = `${normName(owe.member.name)}→${normName(payer.name)}`;
      const existing = map.get(key);
      const part = {
        description: detail.expense.description,
        dateLabel: detail.expense.dateLabel,
        amountInr: owe.amountInr,
        expenseId: detail.expense.id,
      };
      if (existing) {
        existing.amountInr += owe.amountInr;
        existing.parts.push(part);
      } else {
        map.set(key, {
          from: owe.member,
          to: payer,
          amountInr: owe.amountInr,
          parts: [part],
        });
      }
    }
  }
  return [...map.values()]
    .map((row) => ({ ...row, amountInr: Math.round(row.amountInr) }))
    .filter((row) => row.amountInr > 0)
    .sort((a, b) => b.amountInr - a.amountInr || a.to.name.localeCompare(b.to.name));
}

/**
 * Outstanding pair debts after marking shares as paid.
 * ₹200 dinner + ₹30 breakfast − ₹230 settled → nothing pending.
 */
export function buildSummedPairDebts(
  expenses: ExpenseRecord[],
  members: TripMember[],
  settlements: DebtSettlement[] = [],
): SummedPairDebt[] {
  const gross = buildGrossPairDebts(expenses, members);
  if (!settlements.length) return gross;

  return gross
    .map((row) => {
      let remainingSettle = settlements
        .filter(
          (s) =>
            (s.fromPersonId === row.from.id || normName(s.fromPersonName) === normName(row.from.name)) &&
            (s.toPersonId === row.to.id || normName(s.toPersonName) === normName(row.to.name)),
        )
        .reduce((sum, s) => sum + s.amountInr, 0);

      const parts = row.parts.map((part) => {
        const take = Math.min(part.amountInr, remainingSettle);
        remainingSettle -= take;
        return { ...part, amountInr: Math.max(0, part.amountInr - take) };
      }).filter((p) => p.amountInr > 0);

      const amountInr = parts.reduce((s, p) => s + p.amountInr, 0);
      return { ...row, amountInr: Math.round(amountInr), parts };
    })
    .filter((row) => row.amountInr > 0)
    .sort((a, b) => b.amountInr - a.amountInr || a.to.name.localeCompare(b.to.name));
}

export function buildReceiveSummaries(
  expenses: ExpenseRecord[],
  members: TripMember[],
  settlements: DebtSettlement[] = [],
): ReceiveSummary[] {
  const pairs = buildSummedPairDebts(expenses, members, settlements);
  return members
    .map((member) => {
      const inbound = pairs.filter(
        (p) => p.to.id === member.id || normName(p.to.name) === normName(member.name),
      );
      const fromMap = new Map<string, { member: TripMember; amountInr: number }>();
      for (const p of inbound) {
        const key = normName(p.from.name) || p.from.id;
        const cur = fromMap.get(key);
        if (cur) cur.amountInr += p.amountInr;
        else fromMap.set(key, { member: p.from, amountInr: p.amountInr });
      }
      return {
        member,
        totalToReceiveInr: inbound.reduce((s, p) => s + p.amountInr, 0),
        fromDebtors: [...fromMap.values()].sort((a, b) => b.amountInr - a.amountInr),
      };
    })
    .filter((r) => r.totalToReceiveInr > 0)
    .sort((a, b) => b.totalToReceiveInr - a.totalToReceiveInr);
}

export function buildPaySummaries(
  expenses: ExpenseRecord[],
  members: TripMember[],
  settlements: DebtSettlement[] = [],
): PaySummary[] {
  const pairs = buildSummedPairDebts(expenses, members, settlements);
  return members
    .map((member) => {
      const outbound = pairs.filter(
        (p) => p.from.id === member.id || normName(p.from.name) === normName(member.name),
      );
      const toMap = new Map<string, { member: TripMember; amountInr: number }>();
      for (const p of outbound) {
        const key = normName(p.to.name) || p.to.id;
        const cur = toMap.get(key);
        if (cur) cur.amountInr += p.amountInr;
        else toMap.set(key, { member: p.to, amountInr: p.amountInr });
      }
      return {
        member,
        totalToPayInr: outbound.reduce((s, p) => s + p.amountInr, 0),
        toCreditors: [...toMap.values()].sort((a, b) => b.amountInr - a.amountInr),
      };
    })
    .filter((r) => r.totalToPayInr > 0)
    .sort((a, b) => b.totalToPayInr - a.totalToPayInr);
}

/** How much is still owed from A to B after settlements (optional note like "train"). */
export function outstandingBetweenSimple(
  expenses: ExpenseRecord[],
  members: TripMember[],
  settlements: DebtSettlement[],
  fromId: string,
  toId: string,
  noteHint?: string,
): number {
  const outstandingPairs = buildSummedPairDebts(expenses, members, settlements);
  const pair = outstandingPairs.find((p) => p.from.id === fromId && p.to.id === toId);
  if (!pair) return 0;
  const hint = (noteHint || '').trim().toLowerCase();
  if (!hint) return pair.amountInr;
  const matched = pair.parts.filter((part) => {
    const d = part.description.toLowerCase();
    return (
      d.includes(hint) ||
      hint.includes(d) ||
      hint.split(/\s+/).some((w) => w.length > 2 && d.includes(w))
    );
  });
  if (!matched.length) return pair.amountInr;
  return matched.reduce((s, p) => s + p.amountInr, 0);
}
