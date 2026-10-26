import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { DebtSettlement, ExpenseRecord, TripMember } from './expenseStore';
import {
  addDebtSettlement,
  deleteDebtSettlement,
  getExpenseState,
  subscribeExpenses,
} from './expenseStore';
import {
  buildAllExpenseSplits,
  buildNetBalances,
  buildPaySummaries,
  buildReceiveSummaries,
  buildSummedPairDebts,
  formatSplitParticipants,
  simplifySettlements,
} from './expenseSplit';
import { downloadExpenseSplitPdf } from './expenseSplitPdf';
import ListFilterBar from './ListFilterBar';
import ListPager, { pageSlice } from './ListPager';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** Keep high enough that a full 10-traveller group fits without hiding names. */
const PAGE_CARDS = 20;
const PAGE_PAIRS = 40;
const PAGE_TABLE = 12;

function formatLoggedAt(ts: number): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

type Tab = 'summed' | 'settle' | 'balances' | 'splits' | 'ledger' | 'paid';

type Props = {
  members: TripMember[];
  expenses: ExpenseRecord[];
  focusName?: string | null;
};

export default function ExpenseSplitPanel({ members, expenses, focusName }: Props) {
  const [tab, setTab] = useState<Tab>('summed');
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [debtSettlements, setDebtSettlements] = useState<DebtSettlement[]>(
    () => getExpenseState().settlements || [],
  );
  const [markPair, setMarkPair] = useState<{
    fromId: string;
    toId: string;
    amount: number;
    maxAmount: number;
    note?: string;
  } | null>(null);
  const [receivePage, setReceivePage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [pairPage, setPairPage] = useState(1);
  const [settlePage, setSettlePage] = useState(1);
  const [balancePage, setBalancePage] = useState(1);
  const [splitsPage, setSplitsPage] = useState(1);
  const [ledgerPairPage, setLedgerPairPage] = useState(1);
  const [ledgerSplitPage, setLedgerSplitPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  /** Collapsed by default — spending breakdowns can get long. */
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(() => new Set());

  useEffect(() => subscribeExpenses(() => {
    setDebtSettlements(getExpenseState().settlements || []);
  }), []);

  function pairKey(fromId: string, toId: string): string {
    return `${fromId}→${toId}`;
  }

  function togglePairExpanded(key: string) {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    setReceivePage(1);
    setPayPage(1);
    setPairPage(1);
    setSettlePage(1);
    setBalancePage(1);
    setSplitsPage(1);
    setLedgerPairPage(1);
    setLedgerSplitPage(1);
    setPaidPage(1);
  }, [search, payerFilter, categoryFilter, dateFilter, focusName, tab]);

  const splits = useMemo(() => buildAllExpenseSplits(expenses, members), [expenses, members]);
  const balances = useMemo(
    () => buildNetBalances(expenses, members, debtSettlements),
    [expenses, members, debtSettlements],
  );
  const settlements = useMemo(() => simplifySettlements(balances), [balances]);
  const pairDebts = useMemo(
    () => buildSummedPairDebts(expenses, members, debtSettlements),
    [expenses, members, debtSettlements],
  );
  const receiveRows = useMemo(
    () => buildReceiveSummaries(expenses, members, debtSettlements),
    [expenses, members, debtSettlements],
  );
  const payRows = useMemo(
    () => buildPaySummaries(expenses, members, debtSettlements),
    [expenses, members, debtSettlements],
  );

  const categories = useMemo(
    () => [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort(),
    [expenses],
  );
  const dateLabels = useMemo(
    () => [...new Set(expenses.map((e) => e.dateLabel).filter(Boolean))],
    [expenses],
  );

  const q = search.trim().toLowerCase();

  const filteredSplits = useMemo(() => {
    return splits.filter((d) => {
      if (focusName) {
        const hit =
          d.expense.paidByName.toLowerCase() === focusName.toLowerCase() ||
          d.participants.some((p) => p.name.toLowerCase() === focusName.toLowerCase());
        if (!hit) return false;
      }
      if (payerFilter !== 'all' && d.expense.paidByPersonId !== payerFilter) return false;
      if (categoryFilter !== 'all' && d.expense.category !== categoryFilter) return false;
      if (dateFilter !== 'all' && d.expense.dateLabel !== dateFilter) return false;
      if (!q) return true;
      const blob = [
        d.expense.description,
        d.expense.paidByName,
        d.expense.category,
        d.expense.dateLabel,
        ...d.participants.map((p) => p.name),
        ...d.excluded.map((p) => p.name),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [splits, focusName, payerFilter, categoryFilter, dateFilter, q]);

  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      if (focusName) {
        const hit =
          s.from.name.toLowerCase() === focusName.toLowerCase() ||
          s.to.name.toLowerCase() === focusName.toLowerCase();
        if (!hit) return false;
      }
      if (!q) return true;
      return `${s.from.name} ${s.to.name}`.toLowerCase().includes(q);
    });
  }, [settlements, focusName, q]);

  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      if (focusName && b.member.name.toLowerCase() !== focusName.toLowerCase()) return false;
      if (!q) return true;
      return b.member.name.toLowerCase().includes(q);
    });
  }, [balances, focusName, q]);

  const filteredPairs = useMemo(() => {
    return pairDebts.filter((p) => {
      if (focusName) {
        const hit =
          p.from.name.toLowerCase() === focusName.toLowerCase() ||
          p.to.name.toLowerCase() === focusName.toLowerCase();
        if (!hit) return false;
      }
      // Person filter: show debts involving them as payer or receiver.
      if (
        payerFilter !== 'all' &&
        p.to.id !== payerFilter &&
        p.from.id !== payerFilter
      ) {
        return false;
      }
      if (!q) return true;
      const blob = `${p.from.name} ${p.to.name} ${p.parts.map((x) => x.description).join(' ')}`.toLowerCase();
      return blob.includes(q);
    });
  }, [pairDebts, focusName, payerFilter, q]);

  const filteredReceive = useMemo(() => {
    return receiveRows.filter((r) => {
      if (focusName && r.member.name.toLowerCase() !== focusName.toLowerCase()) return false;
      if (payerFilter !== 'all' && r.member.id !== payerFilter) return false;
      if (!q) return true;
      return (
        r.member.name.toLowerCase().includes(q) ||
        r.fromDebtors.some((d) => d.member.name.toLowerCase().includes(q))
      );
    });
  }, [receiveRows, focusName, payerFilter, q]);

  const filteredPay = useMemo(() => {
    return payRows.filter((r) => {
      if (focusName && r.member.name.toLowerCase() !== focusName.toLowerCase()) return false;
      if (
        payerFilter !== 'all' &&
        r.member.id !== payerFilter &&
        !r.toCreditors.some((c) => c.member.id === payerFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.member.name.toLowerCase().includes(q) ||
        r.toCreditors.some((d) => d.member.name.toLowerCase().includes(q))
      );
    });
  }, [payRows, focusName, payerFilter, q]);

  /** Full name roll-call of everyone who still owes (for Clear debts header). */
  const owingRoster = useMemo(() => {
    return filteredPay.map((r) => ({
      id: r.member.id,
      name: r.member.name,
      amountInr: r.totalToPayInr,
      toNames: r.toCreditors.map((c) => c.member.name).join(', '),
    }));
  }, [filteredPay]);

  const filteredPaid = useMemo(() => {
    return [...debtSettlements]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((s) => {
        if (focusName) {
          const hit =
            s.fromPersonName.toLowerCase() === focusName.toLowerCase() ||
            s.toPersonName.toLowerCase() === focusName.toLowerCase();
          if (!hit) return false;
        }
        if (!q) return true;
        return `${s.fromPersonName} ${s.toPersonName} ${s.note || ''}`.toLowerCase().includes(q);
      });
  }, [debtSettlements, focusName, q]);

  const pagedReceive = pageSlice(filteredReceive, receivePage, PAGE_CARDS);
  const pagedPay = pageSlice(filteredPay, payPage, PAGE_CARDS);
  const pagedPairs = pageSlice(filteredPairs, pairPage, PAGE_PAIRS);
  const pagedSettlements = pageSlice(filteredSettlements, settlePage, PAGE_TABLE);
  const pagedBalances = pageSlice(filteredBalances, balancePage, PAGE_TABLE);
  const pagedSplits = pageSlice(filteredSplits, splitsPage, PAGE_TABLE);
  const pagedLedgerPairs = pageSlice(filteredPairs, ledgerPairPage, PAGE_TABLE);
  const pagedLedgerSplits = pageSlice(filteredSplits, ledgerSplitPage, PAGE_TABLE);
  const pagedPaid = pageSlice(filteredPaid, paidPage, PAGE_TABLE);

  if (!members.length) {
    return (
      <section className="expense-split-panel">
        <h3>Bill splits</h3>
        <p className="traveller-ledger-empty">Add travellers, then log spends — they split equally by default.</p>
      </section>
    );
  }

  return (
    <section className="expense-split-panel">
      <div className="expense-split-head">
        <div>
          <h3>Bill splits (Splitwise)</h3>
          <p className="traveller-ledger-hint">
            Open <b>Summed totals</b> to see rolled-up amounts (₹200 dinner + ₹30 breakfast → ₹230 to one person).
            Search and filters work on every tab. Download PDF for a printable settlement sheet.
          </p>
        </div>
        <div className="expense-split-head-actions">
          <button
            type="button"
            className="expense-split-pdf-btn"
            onClick={() => downloadExpenseSplitPdf(members, expenses, debtSettlements, focusName)}
          >
            <Download size={14} /> Download PDF
          </button>
          <div className="expense-split-tabs" role="tablist" aria-label="Split views">
            <button type="button" className={tab === 'summed' ? 'on' : ''} onClick={() => setTab('summed')}>
              Summed totals
              {filteredReceive.length > 0 ? ` (${filteredReceive.length})` : ''}
            </button>
            <button type="button" className={tab === 'settle' ? 'on' : ''} onClick={() => setTab('settle')}>
              Settle up
            </button>
            <button type="button" className={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>
              Net balances
            </button>
            <button type="button" className={tab === 'splits' ? 'on' : ''} onClick={() => setTab('splits')}>
              Per expense
            </button>
            <button type="button" className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')}>
              Full ledger
            </button>
            <button type="button" className={tab === 'paid' ? 'on' : ''} onClick={() => setTab('paid')}>
              Paid / cleared
            </button>
          </div>
        </div>
      </div>

      {filteredReceive.length > 0 ? (
        <div className="expense-sum-preview" aria-label="Summed amounts to give each person">
          <div className="expense-sum-preview-head">
            <div>
              <p className="expense-settle-kicker">At a glance</p>
              <strong>Still to give</strong>
            </div>
            <button type="button" className="expense-sum-preview-link" onClick={() => setTab('summed')}>
              Open full summed view
            </button>
          </div>
          <div className="expense-sum-preview-grid">
            {filteredReceive.map((r) => (
              <article key={r.member.id} className="expense-sum-preview-card">
                <div className="expense-sum-preview-card-top">
                  <span className="expense-settle-avatar is-sm" aria-hidden>
                    {r.member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <small>Give to {r.member.name}</small>
                </div>
                <strong>{fmt(r.totalToReceiveInr)}</strong>
                <div className="expense-settle-chips">
                  {r.fromDebtors.map((d) => (
                    <span key={d.member.id} className="expense-settle-chip">
                      <b>{d.member.name}</b>
                      <em>{fmt(d.amountInr)}</em>
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="expense-sum-preview expense-sum-preview-clear">
          <strong>All split shares cleared</strong>
          <span>No pending amounts — everything marked paid (or nothing to settle yet).</span>
        </div>
      )}

      <ListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search traveller, expense, category…"
        resultCount={
          tab === 'summed'
            ? filteredPairs.length
            : tab === 'settle'
              ? filteredSettlements.length
              : tab === 'balances'
                ? filteredBalances.length
                : filteredSplits.length
        }
        resultLabel="rows"
        onClear={() => {
          setSearch('');
          setPayerFilter('all');
          setCategoryFilter('all');
          setDateFilter('all');
        }}
        filters={[
          {
            id: 'payer',
            label: 'Traveller',
            value: payerFilter,
            onChange: setPayerFilter,
            options: [
              { value: 'all', label: 'All travellers' },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ],
          },
          {
            id: 'category',
            label: 'Category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [
              { value: 'all', label: 'All categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ],
          },
          {
            id: 'date',
            label: 'Trip date',
            value: dateFilter,
            onChange: setDateFilter,
            options: [
              { value: 'all', label: 'All dates' },
              ...dateLabels.map((d) => ({ value: d, label: d })),
            ],
          },
        ]}
      />

      {tab === 'summed' && (
        <div className="expense-summed-stack">
          <div className="expense-settle-board">
            <section className="expense-settle-col is-receive" aria-label="To receive">
              <header className="expense-settle-col-head">
                <div>
                  <p className="expense-settle-kicker">Incoming</p>
                  <h4>To receive</h4>
                  <p>What others still owe each spender</p>
                </div>
                <span className="expense-settle-count">{filteredReceive.length}</span>
              </header>
              {filteredReceive.length === 0 ? (
                <p className="expense-settle-empty">No receivable amounts right now.</p>
              ) : (
                <>
                  <ul className="expense-settle-list">
                    {pagedReceive.slice.map((r) => (
                      <li key={r.member.id} className="expense-settle-card">
                        <div className="expense-settle-card-top">
                          <span className="expense-settle-avatar" aria-hidden>
                            {r.member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="expense-settle-who">
                            <strong>{r.member.name}</strong>
                            <span>Should receive</span>
                          </div>
                          <div className="expense-settle-amt is-receive">{fmt(r.totalToReceiveInr)}</div>
                        </div>
                        <div className="expense-settle-chips" aria-label={`From debtors to ${r.member.name}`}>
                          {r.fromDebtors.map((d) => (
                            <span key={d.member.id} className="expense-settle-chip">
                              <b>{d.member.name}</b>
                              <em>{fmt(d.amountInr)}</em>
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <ListPager
                    page={pagedReceive.safePage}
                    pageCount={pagedReceive.pageCount}
                    total={filteredReceive.length}
                    pageSize={PAGE_CARDS}
                    label="to receive"
                    onChange={setReceivePage}
                  />
                </>
              )}
            </section>

            <section className="expense-settle-col is-pay" aria-label="To pay">
              <header className="expense-settle-col-head">
                <div>
                  <p className="expense-settle-kicker">Outgoing</p>
                  <h4>To pay</h4>
                  <p>What each traveller still needs to give</p>
                </div>
                <span className="expense-settle-count">{filteredPay.length}</span>
              </header>
              {filteredPay.length === 0 ? (
                <p className="expense-settle-empty">No payable amounts right now.</p>
              ) : (
                <>
                  <ul className="expense-settle-list">
                    {pagedPay.slice.map((r) => (
                      <li key={r.member.id} className="expense-settle-card">
                        <div className="expense-settle-card-top">
                          <span className="expense-settle-avatar" aria-hidden>
                            {r.member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="expense-settle-who">
                            <strong>{r.member.name}</strong>
                            <span>Should pay</span>
                          </div>
                          <div className="expense-settle-amt is-pay">{fmt(r.totalToPayInr)}</div>
                        </div>
                        <div className="expense-settle-chips" aria-label={`Give to for ${r.member.name}`}>
                          {r.toCreditors.map((d) => (
                            <span key={d.member.id} className="expense-settle-chip is-pay">
                              <b>{d.member.name}</b>
                              <em>{fmt(d.amountInr)}</em>
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <ListPager
                    page={pagedPay.safePage}
                    pageCount={pagedPay.pageCount}
                    total={filteredPay.length}
                    pageSize={PAGE_CARDS}
                    label="to pay"
                    onChange={setPayPage}
                  />
                </>
              )}
            </section>
          </div>

          <section className="expense-pair-board" aria-label="Pending pair totals">
            <header className="expense-pair-board-head">
              <div>
                <p className="expense-settle-kicker">Clear debts</p>
                <h4>Pending pair totals</h4>
                <p>
                  Full list of who still needs to pay. Tap <b>Mark paid</b> when the money has been given (or say it in
                  chat).
                </p>
              </div>
              <div className="expense-pair-board-tools">
                {filteredPairs.length > 0 && (
                  <button
                    type="button"
                    className="expense-pair-expand-all"
                    onClick={() => {
                      const keys = filteredPairs.map((p) => pairKey(p.from.id, p.to.id));
                      const allOpen = keys.every((k) => expandedPairs.has(k));
                      setExpandedPairs(allOpen ? new Set() : new Set(keys));
                    }}
                  >
                    {filteredPairs.every((p) => expandedPairs.has(pairKey(p.from.id, p.to.id)))
                      ? 'Collapse all'
                      : 'Expand all'}
                  </button>
                )}
                <button
                  type="button"
                  className="expense-split-pdf-btn is-ghost"
                  onClick={() => downloadExpenseSplitPdf(members, expenses, debtSettlements, focusName)}
                >
                  <Download size={14} /> PDF
                </button>
                <span className="expense-settle-count">{filteredPairs.length}</span>
              </div>
            </header>

            {owingRoster.length > 0 && (
              <div className="expense-owing-roster" aria-label="Everyone who needs to pay">
                <div className="expense-owing-roster-head">
                  <strong>Who needs to pay</strong>
                  <span>
                    {owingRoster.length} traveller{owingRoster.length === 1 ? '' : 's'} · {filteredPairs.length} pending
                    pair{filteredPairs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="expense-owing-roster-list">
                  {owingRoster.map((row) => (
                    <li key={row.id}>
                      <span className="expense-settle-avatar is-sm" aria-hidden>
                        {row.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{row.name}</strong>
                        <small>to {row.toNames}</small>
                      </div>
                      <em>{fmt(row.amountInr)}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredPairs.length === 0 ? (
              <p className="expense-settle-empty">Nothing pending — all cleared or no splits yet.</p>
            ) : (
              <>
                <ul className="expense-pair-list">
                  {pagedPairs.slice.map((p) => {
                    const key = pairKey(p.from.id, p.to.id);
                    const open = expandedPairs.has(key);
                    const spendCount = p.parts.length;
                    return (
                      <li
                        key={key}
                        className={`expense-pair-row${open ? ' is-open' : ''}`}
                      >
                        <button
                          type="button"
                          className="expense-pair-summary"
                          aria-expanded={open}
                          onClick={() => togglePairExpanded(key)}
                        >
                          <span className={`expense-pair-chevron${open ? ' is-open' : ''}`} aria-hidden>
                            <ChevronDown size={16} />
                          </span>
                          <div className="expense-pair-flow">
                            <div className="expense-pair-person">
                              <span className="expense-settle-avatar is-sm" aria-hidden>
                                {p.from.name.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <small>Who pays</small>
                                <strong>{p.from.name}</strong>
                              </div>
                            </div>
                            <span className="expense-pair-arrow" aria-hidden>
                              →
                            </span>
                            <div className="expense-pair-person">
                              <span className="expense-settle-avatar is-sm is-receive-tone" aria-hidden>
                                {p.to.name.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <small>Pays to</small>
                                <strong>{p.to.name}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="expense-pair-amount">
                            <small>Pending</small>
                            <strong>{fmt(p.amountInr)}</strong>
                          </div>
                          <div className="expense-pair-preview">
                            <small>Spends</small>
                            <strong>
                              {spendCount} item{spendCount === 1 ? '' : 's'}
                            </strong>
                            {!open && spendCount > 0 && (
                              <em>
                                {p.parts[0].description}
                                {spendCount > 1 ? ` +${spendCount - 1} more` : ''}
                              </em>
                            )}
                          </div>
                        </button>

                        <div className="expense-pair-action">
                          <button
                            type="button"
                            className="expense-pair-mark"
                            onClick={() =>
                              setMarkPair({
                                fromId: p.from.id,
                                toId: p.to.id,
                                amount: p.amountInr,
                                maxAmount: p.amountInr,
                                note: p.parts.map((x) => x.description).join(', '),
                              })
                            }
                          >
                            Mark paid
                          </button>
                        </div>

                        {open && (
                          <div className="expense-pair-breakdown" id={`pair-break-${key}`}>
                            <small>Breakdown</small>
                            <div className="expense-pair-parts">
                              {p.parts.map((part, idx) => (
                                <span
                                  key={`${part.expenseId || part.description}-${idx}`}
                                  className="expense-pair-part"
                                >
                                  <em>{fmt(part.amountInr)}</em> {part.description}
                                  <i>({part.dateLabel})</i>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <ListPager
                  page={pagedPairs.safePage}
                  pageCount={pagedPairs.pageCount}
                  total={filteredPairs.length}
                  pageSize={PAGE_PAIRS}
                  label="pending pairs"
                  onChange={setPairPage}
                />
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'settle' && (
        <div className="expense-split-table-wrap">
          {filteredSettlements.length === 0 ? (
            <p className="traveller-ledger-empty">
              {splits.length === 0
                ? 'No split expenses yet. New logs split among everyone by default.'
                : 'Everyone is settled — no payments needed.'}
            </p>
          ) : (
            <>
              <table className="expense-split-table">
                <thead>
                  <tr>
                    <th>Who pays</th>
                    <th>Pays to</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSettlements.slice.map((s) => (
                    <tr key={`${s.from.id}-${s.to.id}-${s.amountInr}`}>
                      <td><strong>{s.from.name}</strong> owes</td>
                      <td><strong>{s.to.name}</strong></td>
                      <td className="expenses-amt">{fmt(s.amountInr)}</td>
                      <td className="ledger-summary">
                        To be given to {s.to.name} — {s.from.name} owes {fmt(s.amountInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ListPager
                page={pagedSettlements.safePage}
                pageCount={pagedSettlements.pageCount}
                total={filteredSettlements.length}
                pageSize={PAGE_TABLE}
                label="settle up"
                onChange={setSettlePage}
              />
            </>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="expense-split-table-wrap">
          <table className="expense-split-table">
            <thead>
              <tr>
                <th>Traveller</th>
                <th>Net position</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedBalances.slice.map((b) => (
                <tr key={b.member.id}>
                  <td><strong>{b.member.name}</strong></td>
                  <td className={b.netInr > 0 ? 'ledger-balance' : b.netInr < 0 ? 'ledger-warn' : undefined}>
                    {b.netInr === 0 ? '—' : fmt(Math.abs(b.netInr))}
                  </td>
                  <td className="ledger-summary">
                    {b.netInr > 0
                      ? `Should receive ${fmt(b.netInr)} from the group`
                      : b.netInr < 0
                        ? `Owes ${fmt(-b.netInr)} to the group`
                        : 'Settled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPager
            page={pagedBalances.safePage}
            pageCount={pagedBalances.pageCount}
            total={filteredBalances.length}
            pageSize={PAGE_TABLE}
            label="balances"
            onChange={setBalancePage}
          />
        </div>
      )}

      {tab === 'splits' && (
        <div className="expense-split-table-wrap">
          {filteredSplits.length === 0 ? (
            <p className="traveller-ledger-empty">No expenses match these filters.</p>
          ) : (
            <>
              <table className="expense-split-table expense-split-detail-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Expense</th>
                    <th>Paid by</th>
                    <th>Amount</th>
                    <th>Split among</th>
                    <th>Each share</th>
                    <th>Who owes payer</th>
                    <th>Excluded</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSplits.slice.map((d) => (
                    <tr key={d.expense.id}>
                      <td>{d.expense.dateLabel}</td>
                      <td>{d.expense.description}</td>
                      <td><strong>{d.expense.paidByName}</strong></td>
                      <td className="expenses-amt">{fmt(d.expense.amountInr)}</td>
                      <td>{formatSplitParticipants(d)}</td>
                      <td className="expenses-amt">{fmt(d.shares[0]?.shareInr || 0)}</td>
                      <td className="ledger-summary">
                        {d.owesToPayer.length === 0
                          ? '—'
                          : d.owesToPayer
                              .map((o) => `${o.member.name} ${fmt(o.amountInr)}`)
                              .join(', ')}
                      </td>
                      <td className="ledger-summary">
                        {d.excluded.length === 0 ? '—' : d.excluded.map((m) => m.name).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ListPager
                page={pagedSplits.safePage}
                pageCount={pagedSplits.pageCount}
                total={filteredSplits.length}
                pageSize={PAGE_TABLE}
                label="per expense"
                onChange={setSplitsPage}
              />
            </>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="expense-summed-stack">
          <div className="expense-split-table-wrap">
            <h4 className="expense-summed-title">Ledger summary — summed to each spender</h4>
            <p className="traveller-ledger-hint">
              All per-row shares below are rolled up here (e.g. many ₹200 lines → one total per person).
            </p>
            {filteredPairs.length === 0 ? (
              <p className="traveller-ledger-empty">No pair sums for current filters.</p>
            ) : (
              <>
                <table className="expense-split-table">
                  <thead>
                    <tr>
                      <th>Who pays</th>
                      <th>Pays to</th>
                      <th>Summed amount</th>
                      <th>Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLedgerPairs.slice.map((p) => (
                      <tr key={`ledger-sum-${p.from.id}-${p.to.id}`}>
                        <td><strong>{p.from.name}</strong></td>
                        <td><strong>{p.to.name}</strong></td>
                        <td className="expenses-amt">{fmt(p.amountInr)}</td>
                        <td className="ledger-summary">
                          {p.parts
                            .map((part) => `${fmt(part.amountInr)} ${part.description} (${part.dateLabel})`)
                            .join(' + ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListPager
                  page={pagedLedgerPairs.safePage}
                  pageCount={pagedLedgerPairs.pageCount}
                  total={filteredPairs.length}
                  pageSize={PAGE_TABLE}
                  label="ledger pairs"
                  onChange={setLedgerPairPage}
                />
              </>
            )}
          </div>

          <div className="expense-split-table-wrap">
            <h4 className="expense-summed-title">Full ledger (each expense)</h4>
            {filteredSplits.length === 0 ? (
              <p className="traveller-ledger-empty">No split ledger rows match.</p>
            ) : (
              <>
                <table className="expense-split-table expense-split-ledger-table">
                  <thead>
                    <tr>
                      <th>Trip date</th>
                      <th>Logged at</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Paid by</th>
                      <th>Total</th>
                      <th>People in split</th>
                      <th>Share each</th>
                      <th>Excluded</th>
                      <th>Owes → payer (this bill)</th>
                      <th>Payment</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLedgerSplits.slice.map((d) => (
                      <tr key={d.expense.id}>
                        <td>
                          {d.expense.dateLabel}
                          <div className="expense-ledger-sub">{d.expense.tripDate || '—'}</div>
                        </td>
                        <td>{formatLoggedAt(d.expense.createdAt)}</td>
                        <td>{d.expense.category}</td>
                        <td>{d.expense.description}</td>
                        <td><strong>{d.expense.paidByName}</strong></td>
                        <td className="expenses-amt">{fmt(d.expense.amountInr)}</td>
                        <td className="ledger-summary">
                          {d.participants.map((m) => m.name).join(', ')}
                        </td>
                        <td className="expenses-amt">{fmt(d.shares[0]?.shareInr || 0)}</td>
                        <td className="ledger-summary">
                          {d.excluded.length === 0 ? '—' : d.excluded.map((m) => m.name).join(', ')}
                        </td>
                        <td className="ledger-summary">
                          {d.owesToPayer.length === 0
                            ? '—'
                            : d.owesToPayer
                                .map(
                                  (o) =>
                                    `${o.member.name} → ${d.expense.paidByName} ${fmt(o.amountInr)}`,
                                )
                                .join('; ')}
                        </td>
                        <td>
                          {d.expense.paymentMethod === 'cash'
                            ? 'Cash'
                            : d.expense.paymentMethod === 'online'
                              ? 'Online'
                              : '—'}
                        </td>
                        <td>{d.expense.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListPager
                  page={pagedLedgerSplits.safePage}
                  pageCount={pagedLedgerSplits.pageCount}
                  total={filteredSplits.length}
                  pageSize={PAGE_TABLE}
                  label="ledger expenses"
                  onChange={setLedgerSplitPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'paid' && (
        <div className="expense-split-table-wrap">
          <h4 className="expense-summed-title">Paid / cleared settlements</h4>
          <p className="traveller-ledger-hint">
            These amounts are removed from pending sums. Undo with Delete if marked by mistake.
          </p>
          {filteredPaid.length === 0 ? (
            <p className="traveller-ledger-empty">
              No payments marked yet. Use <b>Mark paid</b> or chat: “I have given the amount of train travel to Sanket”.
            </p>
          ) : (
            <>
            <table className="expense-split-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Cleared</th>
                  <th>For</th>
                  <th>Source</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pagedPaid.slice.map((s) => (
                  <tr key={s.id}>
                    <td>{formatLoggedAt(s.createdAt)}</td>
                    <td><strong>{s.fromPersonName}</strong></td>
                    <td><strong>{s.toPersonName}</strong></td>
                    <td className="expenses-amt ledger-balance">{fmt(s.amountInr)}</td>
                    <td className="ledger-summary">{s.note || '—'}</td>
                    <td>{s.source}</td>
                    <td>
                      <button
                        type="button"
                        className="expense-action-delete"
                        onClick={() => {
                          if (window.confirm(`Undo payment of ${fmt(s.amountInr)} from ${s.fromPersonName} to ${s.toPersonName}?`)) {
                            deleteDebtSettlement(s.id);
                          }
                        }}
                      >
                        Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPager
              page={pagedPaid.safePage}
              pageCount={pagedPaid.pageCount}
              total={filteredPaid.length}
              pageSize={PAGE_TABLE}
              label="paid settlements"
              onChange={setPaidPage}
            />
            </>
          )}
        </div>
      )}

      {markPair && (
        <div className="assistant-settings-backdrop" onClick={() => setMarkPair(null)}>
          <div className="expense-edit-modal expense-edit-modal-wide" onClick={(ev) => ev.stopPropagation()}>
            <h3>Mark as paid</h3>
            <p className="traveller-ledger-hint">
              Clears pending debt from the summed totals. Chat example: “I have given the amount of train travel to
              Sanket”.
            </p>
            {(() => {
              const from = members.find((m) => m.id === markPair.fromId);
              const to = members.find((m) => m.id === markPair.toId);
              return (
                <>
                  <div className="expense-edit-grid">
                    <label>
                      From (who paid)
                      <input value={from?.name || ''} readOnly />
                    </label>
                    <label>
                      To (who receives)
                      <input value={to?.name || ''} readOnly />
                    </label>
                    <label>
                      Amount (INR)
                      <input
                        type="number"
                        min={1}
                        max={markPair.maxAmount}
                        value={markPair.amount}
                        onChange={(e) =>
                          setMarkPair({
                            ...markPair,
                            amount: Math.min(
                              markPair.maxAmount,
                              Math.max(0, parseFloat(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      For (optional)
                      <input
                        value={markPair.note || ''}
                        onChange={(e) => setMarkPair({ ...markPair, note: e.target.value })}
                        placeholder="train travel / dinner / …"
                      />
                    </label>
                  </div>
                  <div className="expense-edit-actions">
                    <button type="button" className="button pale" onClick={() => setMarkPair(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button dark"
                      onClick={() => {
                        if (!from || !to) return;
                        try {
                          addDebtSettlement({
                            fromPersonId: from.id,
                            fromPersonName: from.name,
                            toPersonId: to.id,
                            toPersonName: to.name,
                            amountInr: markPair.amount,
                            note: markPair.note,
                            source: 'manual',
                          });
                          setMarkPair(null);
                          setTab('paid');
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Could not mark paid.');
                        }
                      }}
                    >
                      Confirm paid
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
