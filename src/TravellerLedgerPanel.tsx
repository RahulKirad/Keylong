import React from 'react';
import { buildTravellerLedger, formatGaveToSummary } from './expenseLedger';
import type { ExpenseRecord, FundTransfer, TripMember } from './expenseStore';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type Props = {
  members: TripMember[];
  transfers: FundTransfer[];
  expenses: ExpenseRecord[];
};

export default function TravellerLedgerPanel({ members, transfers, expenses }: Props) {
  const rows = buildTravellerLedger(members, transfers, expenses);

  if (!members.length) {
    return (
      <aside className="traveller-ledger-panel">
        <h3>Traveller balances</h3>
        <p className="traveller-ledger-empty">Add travellers above, then log cash given or expenses via chat.</p>
      </aside>
    );
  }

  return (
    <aside className="traveller-ledger-panel">
      <h3>Traveller balances</h3>
      <p className="traveller-ledger-hint">
        <b>Balance</b> = money others gave them minus spends marked “from balance”. Say in chat: “Rahul gave 5000 to
        Sanket cash” or “Sanket spent 800 dinner from balance cash”.
      </p>
      <div className="traveller-ledger-table-wrap">
        <table className="traveller-ledger-table">
          <thead>
            <tr>
              <th>Traveller</th>
              <th>Balance</th>
              <th>Spent (paid)</th>
              <th>From balance</th>
              <th>Cash</th>
              <th>Online</th>
              <th>Gave to</th>
              <th>Received from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id}>
                <td><strong>{r.member.name}</strong></td>
                <td className={r.balanceRemaining < 0 ? 'ledger-warn' : 'ledger-balance'}>{fmt(r.balanceRemaining)}</td>
                <td>{fmt(r.totalSpentAsPayer)}</td>
                <td>{r.spentFromBalanceTotal > 0 ? fmt(r.spentFromBalanceTotal) : '—'}</td>
                <td>{r.cashSpent > 0 ? fmt(r.cashSpent) : '—'}</td>
                <td>{r.onlineSpent > 0 ? fmt(r.onlineSpent) : '—'}</td>
                <td className="ledger-summary">{formatGaveToSummary(r.gaveToOthers, fmt)}</td>
                <td className="ledger-summary">{formatGaveToSummary(r.receivedFrom, fmt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
