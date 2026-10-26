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

function samePerson(id: string | undefined, storedName: string | undefined, member: TripMember): boolean {
  return id === member.id || Boolean(storedName && storedName.trim().toLowerCase() === member.name.trim().toLowerCase());
}

function sumGaveTo(member: TripMember, transfers: FundTransfer[]): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transfers) {
    if (!samePerson(t.fromPersonId, t.fromPersonName, member)) continue;
    map.set(t.toPersonName, (map.get(t.toPersonName) || 0) + t.amountInr);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount }));
}

function sumReceivedFrom(member: TripMember, transfers: FundTransfer[]): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transfers) {
    if (!samePerson(t.toPersonId, t.toPersonName, member)) continue;
    map.set(t.fromPersonName, (map.get(t.fromPersonName) || 0) + t.amountInr);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount }));
}

export function balanceReceived(memberId: string, transfers: FundTransfer[], memberName?: string): number {
  return transfers
    .filter(
      (t) =>
        t.toPersonId === memberId ||
        Boolean(memberName && t.toPersonName.trim().toLowerCase() === memberName.trim().toLowerCase()),
    )
    .reduce((s, t) => s + t.amountInr, 0);
}

export function balanceSpentFromPool(memberId: string, expenses: ExpenseRecord[], memberName?: string): number {
  const name = memberName?.trim().toLowerCase();
  return expenses
    .filter((e) => {
      if (!e.spentFromBalance) return false;
      const holderId = e.balanceHolderPersonId || e.paidByPersonId;
      const holderName = (e.balanceHolderName || e.paidByName).trim().toLowerCase();
      return holderId === memberId || Boolean(name && holderName === name);
    })
    .reduce((s, e) => s + e.amountInr, 0);
}

export function memberBalanceRemaining(
  memberId: string,
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): number {
  return balanceReceived(memberId, transfers, undefined) - balanceSpentFromPool(memberId, expenses, undefined);
}

export function buildTravellerLedger(
  members: TripMember[],
  transfers: FundTransfer[],
  expenses: ExpenseRecord[],
): TravellerLedgerRow[] {
  return members.map((member) => {
    const paid = expenses.filter(
      (e) =>
        e.countInTotal !== false &&
        (e.paidByPersonId === member.id || e.paidByName.trim().toLowerCase() === member.name.trim().toLowerCase()),
    );
    let cashSpent = 0;
    let onlineSpent = 0;
    for (const e of paid) {
      if (e.paymentMethod === 'cash') cashSpent += e.amountInr;
      else if (e.paymentMethod === 'online') onlineSpent += e.amountInr;
    }
    const spentFromBalanceTotal = balanceSpentFromPool(member.id, expenses, member.name);
    return {
      member,
      balanceRemaining:
        balanceReceived(member.id, transfers, member.name) - balanceSpentFromPool(member.id, expenses, member.name),
      totalSpentAsPayer: paid.reduce((s, e) => s + e.amountInr, 0),
      spentFromBalanceTotal,
      cashSpent,
      onlineSpent,
      gaveToOthers: sumGaveTo(member, transfers),
      receivedFrom: sumReceivedFrom(member, transfers),
    };
  });
}

export function formatGaveToSummary(items: { name: string; amount: number }[], fmt: (n: number) => string): string {
  if (!items.length) return '—';
  return items.map((i) => `${i.name} ${fmt(i.amount)}`).join(', ');
}
