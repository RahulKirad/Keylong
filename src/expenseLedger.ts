import type { ExpenseRecord, FundTransfer, TripMember } from './expenseStore';

export type TravellerLedgerRow = {
  member: TripMember;
  balanceRemaining: number;
  totalSpentAsPayer: number;
  spentFromBalanceTotal: number;
  cashSpent: number;
  onlineSpent: number;
  gaveToOthers: { name: string; amount: number }[];
  receivedFrom: { name: string; amount: number }[];
};

function sumGaveTo(memberId: string, transfers: FundTransfer[]): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transfers) {
    if (t.fromPersonId !== memberId) continue;
    map.set(t.toPersonName, (map.get(t.toPersonName) || 0) + t.amountInr);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount }));
}

function sumReceivedFrom(memberId: string, transfers: FundTransfer[]): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transfers) {
    if (t.toPersonId !== memberId) continue;
    map.set(t.fromPersonName, (map.get(t.fromPersonName) || 0) + t.amountInr);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount }));
}

export function balanceReceived(memberId: string, transfers: FundTransfer[]): number {
  return transfers.filter((t) => t.toPersonId === memberId).reduce((s, t) => s + t.amountInr, 0);
}

export function balanceSpentFromPool(memberId: string, expenses: ExpenseRecord[]): number {
  return expenses
    .filter((e) => e.spentFromBalance && (e.balanceHolderPersonId || e.paidByPersonId) === memberId)
    .reduce((s, e) => s + e.amountInr, 0);
}

export function memberBalanceRemaining(
  memberId: string,
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): number {
  return balanceReceived(memberId, transfers) - balanceSpentFromPool(memberId, expenses);
}

export function buildTravellerLedger(
  members: TripMember[],
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): TravellerLedgerRow[] {
  return members.map((member) => {
    const paid = expenses.filter((e) => e.paidByPersonId === member.id);
    let cashSpent = 0;
    let onlineSpent = 0;
    for (const e of paid) {
      if (e.paymentMethod === 'cash') cashSpent += e.amountInr;
      else if (e.paymentMethod === 'online') onlineSpent += e.amountInr;
    }
    const spentFromBalanceTotal = balanceSpentFromPool(member.id, expenses);
    return {
      member,
      balanceRemaining: memberBalanceRemaining(member.id, transfers, expenses),
      totalSpentAsPayer: paid.reduce((s, e) => s + e.amountInr, 0),
      spentFromBalanceTotal,
      cashSpent,
      onlineSpent,
      gaveToOthers: sumGaveTo(member.id, transfers),
      receivedFrom: sumReceivedFrom(member.id, transfers),
    };
  });
}

export function formatGaveToSummary(items: { name: string; amount: number }[], fmt: (n: number) => string): string {
  if (!items.length) return '—';
  return items.map((i) => `${i.name} ${fmt(i.amount)}`).join(', ');
}
