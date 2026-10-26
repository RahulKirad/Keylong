import React, { useEffect, useState } from 'react';
import { Mic, Pencil, Trash2, Download, Users, Wifi, WifiOff, Bot, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  ExpenseRecord,
  FundTransfer,
  PaymentMethod,
  addDebtSettlement,
  addExpense,
  addFundTransfer,
  addMember,
  deleteExpense,
  deleteFundTransfer,
  exportExpensesCsv,
  getExpenseState,
  removeMember,
  removePending,
  setExpenseCountInTotal,
  subscribeExpenses,
  totalsByMember,
  updateExpense,
  expenseCountsInTotal,
  parseDateFromText,
} from './expenseStore';
import { parseMoneyUtterance } from './expenseParse';
import { loadGeminiConfig } from './geminiConfig';
import { openTripAssistant } from './assistantBridge';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import ExpenseSwipeRow from './ExpenseSwipeRow';
import TravellerLedgerPanel from './TravellerLedgerPanel';
import ExpenseSplitPanel from './ExpenseSplitPanel';
import ExpenseSpendBlocks from './ExpenseSpendBlocks';
import TravellerAvatar from './TravellerAvatar';
import ListFilterBar from './ListFilterBar';
import { expenseIsSplit, participantsForExpense } from './expenseSplit';

type ManualExpenseDraft = {
  dateLabel: string;
  description: string;
  category: string;
  amountInr: number;
  paidByPersonId: string;
  paidByName: string;
  paymentMethod: PaymentMethod;
  splitEnabled: boolean;
  splitExcludedPersonIds: string[];
  countInTotal: boolean;
};

function emptyManualDraft(members: { id: string; name: string }[], signedIn: string | null): ManualExpenseDraft {
  const self = signedIn
    ? members.find((m) => m.name.toLowerCase() === signedIn.toLowerCase())
    : members[0];
  const payer = self || members[0];
  return {
    dateLabel: '25 Dec',
    description: '',
    category: 'Food',
    amountInr: 0,
    paidByPersonId: payer?.id || '',
    paidByName: payer?.name || '',
    paymentMethod: 'unknown',
    splitEnabled: true,
    splitExcludedPersonIds: [],
    countInTotal: true,
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function paymentLabel(m: PaymentMethod): string {
  if (m === 'cash') return 'Cash';
  if (m === 'online') return 'Online';
  return '—';
}

function expenseMetaLine(e: ExpenseRecord): string {
  const parts = [paymentLabel(e.paymentMethod)];
  if (e.spentFromBalance) parts.push(`From ${e.balanceHolderName || e.paidByName}'s balance`);
  if (e.givenByName) parts.push(`Pool from ${e.givenByName}`);
  if (!expenseCountsInTotal(e)) parts.push('Excluded from total');
  return parts.filter((p) => p !== '—').join(' · ') || '—';
}

type ExpensesSectionProps = {
  standalone?: boolean;
};

const EXPENSES_PAGE_SIZE = 10;

function samePerson(value: string | undefined, name: string): boolean {
  return (value || '').trim().toLowerCase() === name.trim().toLowerCase();
}

export default function ExpensesSection({ standalone = false }: ExpensesSectionProps) {
  const [snap, setSnap] = useState(getExpenseState());
  const [online, setOnline] = useState(navigator.onLine);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<ManualExpenseDraft | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [signedInName, setSignedInName] = useState<string | null>(() => getSelectedTraveller());
  /** null = whole group ledger (shared). Otherwise filter to one traveller. */
  const [focusName, setFocusName] = useState<string | null>(null);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [splitFilter, setSplitFilter] = useState('all');
  const [totalFilter, setTotalFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const refresh = () => setSnap(getExpenseState());

  useEffect(() => subscribeExpenses(refresh), []);
  useEffect(() => subscribeSelectedTraveller(setSignedInName), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const processPending = async () => {
    const { pending } = getExpenseState();
    if (!pending.length || !navigator.onLine) return;
    setSyncing(true);
    const config = loadGeminiConfig();
    for (const p of pending) {
      try {
        const parsed = await parseMoneyUtterance(p.rawText, config, true, getSelectedTraveller() || undefined);
        if (parsed.kind === 'give') addFundTransfer(parsed);
        else if (parsed.kind === 'settle') addDebtSettlement(parsed);
        else addExpense(parsed);
        removePending(p.id);
      } catch {
        /* keep in queue */
      }
    }
    refresh();
    setSyncing(false);
  };

  useEffect(() => {
    if (online) processPending();
  }, [online, snap.pending.length]);

  const memberTotals = totalsByMember();
  const focusMember = focusName
    ? snap.members.find((member) => samePerson(member.name, focusName))
    : undefined;
  const focusExpenses = focusName
    ? snap.expenses.filter(
        (expense) =>
          samePerson(expense.paidByName, focusName) ||
          samePerson(expense.balanceHolderName, focusName) ||
          samePerson(expense.givenByName, focusName),
      )
    : snap.expenses;
  const expenseCategories = [...new Set(snap.expenses.map((e) => e.category).filter(Boolean))].sort();
  const expenseDates = [...new Set(snap.expenses.map((e) => e.dateLabel).filter(Boolean))];
  const qExpense = expenseSearch.trim().toLowerCase();
  const visibleExpenses = focusExpenses.filter((expense) => {
    if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
    if (payerFilter !== 'all' && expense.paidByPersonId !== payerFilter) return false;
    if (paymentFilter !== 'all' && expense.paymentMethod !== paymentFilter) return false;
    if (dateFilter !== 'all' && expense.dateLabel !== dateFilter) return false;
    if (splitFilter === 'split' && !expenseIsSplit(expense)) return false;
    if (splitFilter === 'nosplit' && expenseIsSplit(expense)) return false;
    if (totalFilter === 'counted' && !expenseCountsInTotal(expense)) return false;
    if (totalFilter === 'excluded' && expenseCountsInTotal(expense)) return false;
    if (!qExpense) return true;
    const blob = [
      expense.description,
      expense.category,
      expense.paidByName,
      expense.dateLabel,
      expense.paymentMethod,
      expense.givenByName,
      expense.balanceHolderName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(qExpense);
  });
  const visibleTransfers = focusName
    ? snap.transfers.filter(
        (transfer) =>
          samePerson(transfer.fromPersonName, focusName) || samePerson(transfer.toPersonName, focusName),
      )
    : snap.transfers;
  const visibleTotals = focusName
    ? memberTotals.filter(({ member }) => samePerson(member.name, focusName))
    : memberTotals;
  const countedExpenses = visibleExpenses.filter(expenseCountsInTotal);
  const total = countedExpenses.reduce((sum, expense) => sum + expense.amountInr, 0);
  const excludedCount = visibleExpenses.length - countedExpenses.length;
  const expensePageCount = Math.max(1, Math.ceil(visibleExpenses.length / EXPENSES_PAGE_SIZE));
  const safeExpensePage = Math.min(expensePage, expensePageCount);
  const expensePageStart = (safeExpensePage - 1) * EXPENSES_PAGE_SIZE;
  const pagedExpenses = visibleExpenses.slice(expensePageStart, expensePageStart + EXPENSES_PAGE_SIZE);
  const expenseRangeEnd = Math.min(expensePageStart + pagedExpenses.length, visibleExpenses.length);

  useEffect(() => {
    setExpensePage(1);
  }, [focusName, expenseSearch, categoryFilter, payerFilter, paymentFilter, splitFilter, totalFilter, dateFilter]);

  useEffect(() => {
    if (expensePage > expensePageCount) setExpensePage(expensePageCount);
  }, [expensePage, expensePageCount]);

  function addPerson() {
    addMember(newName);
    setNewName('');
    refresh();
  }

  function openManualForm() {
    setManual(emptyManualDraft(snap.members, signedInName));
    setManualOpen(true);
  }

  function saveManual() {
    if (!manual || !manual.paidByPersonId) return;
    if (!manual.description.trim() || manual.amountInr <= 0) {
      window.alert('Enter a description and amount.');
      return;
    }
    const date = parseDateFromText(manual.dateLabel) || {
      tripDate: '2026-12-25',
      dateLabel: manual.dateLabel || '25 Dec',
    };
    try {
      addExpense({
        tripDate: date.tripDate,
        dateLabel: date.dateLabel,
        description: manual.description.trim(),
        category: manual.category,
        amountInr: manual.amountInr,
        paidByPersonId: manual.paidByPersonId,
        paidByName: manual.paidByName,
        paymentMethod: manual.paymentMethod,
        spentFromBalance: false,
        countInTotal: manual.countInTotal,
        splitEnabled: manual.splitEnabled,
        splitExcludedPersonIds: manual.splitExcludedPersonIds,
        source: 'manual',
      });
      setManualOpen(false);
      setManual(null);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not add expense.');
    }
  }

  function saveEdit() {
    if (!editing) return;
    try {
      updateExpense(editing.id, {
        tripDate: editing.tripDate,
        dateLabel: editing.dateLabel,
        description: editing.description,
        category: editing.category,
        amountInr: editing.amountInr,
        paidByPersonId: editing.paidByPersonId,
        paidByName: editing.paidByName,
        paymentMethod: editing.paymentMethod,
        spentFromBalance: editing.spentFromBalance,
        balanceHolderPersonId: editing.spentFromBalance
          ? editing.balanceHolderPersonId || editing.paidByPersonId
          : undefined,
        balanceHolderName: editing.spentFromBalance
          ? editing.balanceHolderName || editing.paidByName
          : undefined,
        givenByPersonId: editing.givenByPersonId,
        givenByName: editing.givenByName,
        countInTotal: editing.countInTotal !== false,
        splitEnabled: editing.splitEnabled !== false,
        splitExcludedPersonIds: editing.splitExcludedPersonIds || [],
        source: editing.source,
      });
      setEditing(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save');
    }
  }

  function downloadCsv() {
    const blob = new Blob([exportExpensesCsv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spiti-tour-2026-expenses.csv';
    a.click();
  }

  function confirmDeleteExpense(e: ExpenseRecord) {
    const ok = window.confirm(
      `Delete this entry?\n\n${e.dateLabel} · ${e.description}\n${fmt(e.amountInr)} · ${e.paidByName}`,
    );
    if (!ok) return;
    deleteExpense(e.id);
    if (editing?.id === e.id) setEditing(null);
    refresh();
  }

  function confirmDeleteTransfer(t: FundTransfer) {
    const ok = window.confirm(
      `Delete transfer?\n\n${t.fromPersonName} → ${t.toPersonName}\n${fmt(t.amountInr)}`,
    );
    if (!ok) return;
    deleteFundTransfer(t.id);
    refresh();
  }

  function confirmDeletePending(id: string, rawText: string) {
    if (!window.confirm(`Remove pending note?\n\n"${rawText}"`)) return;
    removePending(id);
    refresh();
  }

  return (
    <section id={standalone ? undefined : 'expenses'} className="section expenses-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">GROUP TRIP MONEY</div>
          <h2>{standalone ? 'Spiti Tour Expenses' : 'Shared expenses tally.'}</h2>
          <p>
            Shared group ledger — everyone sees the same expenses after sync. Signed in as{' '}
            <b>{signedInName || '…'}</b>. You can log anyone’s spend by name, e.g. “Sanket spent 200 cash for dinner on
            24th”.
          </p>
        </div>
        <div className="expenses-status">
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'Online · cloud sync' : 'Offline — saved locally, syncs when online'}
          {snap.pending.length > 0 && (
            <span className="expenses-pending">{snap.pending.length} pending parse</span>
          )}
        </div>
      </div>

      <div className="assistant-name-row expenses-focus-row">
        <span className="assistant-name-label">Show ledger for</span>
        <button type="button" className={!focusName ? 'on' : ''} onClick={() => setFocusName(null)}>
          Everyone
        </button>
        {snap.members.map((member) => (
          <button
            key={member.id}
            type="button"
            className={`expenses-focus-person${focusName && samePerson(focusName, member.name) ? ' on' : ''}`}
            onClick={() => setFocusName(member.name)}
          >
            <TravellerAvatar name={member.name} personId={member.id} size="sm" />
            <span>
              {member.name}
              {signedInName && samePerson(signedInName, member.name) ? ' (you)' : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="expenses-toolbar">
        <button type="button" className="button dark" onClick={openManualForm} disabled={!snap.members.length}>
          <Plus size={15} /> Add expense manually
        </button>
        <button type="button" className="button pale" onClick={() => openTripAssistant('expense')}>
          <Mic size={15} /> Voice log expense
        </button>
        <button type="button" className="button pale" onClick={() => openTripAssistant('expense')}>
          <Bot size={15} /> Open expense assistant
        </button>
        <button type="button" className="button pale" onClick={downloadCsv}>
          <Download size={15} /> Export CSV
        </button>
        {snap.pending.length > 0 && online && (
          <button type="button" className="button pale" onClick={processPending} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Process pending with AI'}
          </button>
        )}
      </div>

      <div className="expenses-members">
        <div className="expenses-members-head">
          <Users size={16} /> Travellers ({snap.members.length}/10)
        </div>
        <p className="traveller-ledger-hint expenses-members-hint">
          Tap the camera on a traveller to upload their profile photo — it syncs for every login.
        </p>
        <div className="expenses-member-chips expenses-member-profiles">
          {snap.members.map((m) => (
            <article key={m.id} className="expense-member-card">
              <TravellerAvatar name={m.name} personId={m.id} size="lg" editable />
              <div className="expense-member-card-meta">
                <strong>{m.name}</strong>
                {signedInName && samePerson(signedInName, m.name) ? (
                  <span className="expense-member-you">You</span>
                ) : null}
              </div>
              <button
                type="button"
                className="expense-member-remove"
                aria-label={`Remove ${m.name}`}
                onClick={() => {
                  removeMember(m.id);
                  refresh();
                }}
              >
                ×
              </button>
            </article>
          ))}
        </div>
        {snap.members.length < 10 && (
          <div className="expenses-add-member">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add name (e.g. Rahul)"
              onKeyDown={(e) => e.key === 'Enter' && addPerson()}
            />
            <button type="button" className="button dark" onClick={addPerson}>Add</button>
          </div>
        )}
      </div>

      <div className="expenses-layout">
        <div className="expenses-layout-main">
          <div className="expenses-summary-grid">
            <article className="expenses-summary-card expenses-summary-total">
              <small>{focusName ? `${focusName.toUpperCase()} SPENT` : 'GROUP TOTAL SPENT'}</small>
              <strong>{fmt(total)}</strong>
              <span>
                {countedExpenses.length} counted
                {excludedCount > 0 ? ` · ${excludedCount} excluded` : ''}
              </span>
            </article>
            {visibleTotals.map(({ member, total: t }) => (
              <article key={member.id} className="expenses-summary-card">
                <small>{member.name.toUpperCase()}</small>
                <strong>{fmt(t)}</strong>
                <span>Paid at shop</span>
              </article>
            ))}
          </div>

          {visibleTransfers.length > 0 && (
            <div className="expenses-transfers-block">
              <h4>Cash given to travellers</h4>
              <div className="expenses-table-wrap expenses-transfers-wrap">
                <table className="expenses-table expenses-transfers-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTransfers.map((t) => (
                      <tr key={t.id}>
                        <td>{t.dateLabel}</td>
                        <td><strong>{t.fromPersonName}</strong></td>
                        <td><strong>{t.toPersonName}</strong></td>
                        <td className="expenses-amt">{fmt(t.amountInr)}</td>
                        <td>{paymentLabel(t.paymentMethod)}</td>
                        <td className="expenses-actions">
                          <button
                            type="button"
                            className="expense-action-delete"
                            onClick={() => confirmDeleteTransfer(t)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {snap.pending.length > 0 && (
            <div className="expenses-pending-list">
              <h4>Pending (not yet parsed)</h4>
              <ul>
                {snap.pending.map((p) => (
                  <li key={p.id}>
                    <span>{p.rawText}</span>
                    <button type="button" className="expense-delete-text" onClick={() => confirmDeletePending(p.id, p.rawText)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="expenses-delete-hint">
            Use <b>In total</b> to confirm whether each amount counts toward group / member totals. Uncheck to keep the
            log without adding the spend. Swipe left on mobile or tap <b>Delete</b> to remove a row.
          </p>

          <ListFilterBar
            search={expenseSearch}
            onSearchChange={setExpenseSearch}
            searchPlaceholder="Search description, payer, date…"
            resultCount={visibleExpenses.length}
            resultLabel="expenses"
            onClear={() => {
              setExpenseSearch('');
              setCategoryFilter('all');
              setPayerFilter('all');
              setPaymentFilter('all');
              setSplitFilter('all');
              setTotalFilter('all');
              setDateFilter('all');
            }}
            filters={[
              {
                id: 'category',
                label: 'Category',
                value: categoryFilter,
                onChange: setCategoryFilter,
                options: [
                  { value: 'all', label: 'All categories' },
                  ...expenseCategories.map((c) => ({ value: c, label: c })),
                ],
              },
              {
                id: 'payer',
                label: 'Paid by',
                value: payerFilter,
                onChange: setPayerFilter,
                options: [
                  { value: 'all', label: 'All payers' },
                  ...snap.members.map((m) => ({ value: m.id, label: m.name })),
                ],
              },
              {
                id: 'date',
                label: 'Trip date',
                value: dateFilter,
                onChange: setDateFilter,
                options: [
                  { value: 'all', label: 'All dates' },
                  ...expenseDates.map((d) => ({ value: d, label: d })),
                ],
              },
              {
                id: 'payment',
                label: 'Payment',
                value: paymentFilter,
                onChange: setPaymentFilter,
                options: [
                  { value: 'all', label: 'All payments' },
                  { value: 'cash', label: 'Cash' },
                  { value: 'online', label: 'Online' },
                  { value: 'unknown', label: 'Not specified' },
                ],
              },
              {
                id: 'split',
                label: 'Split',
                value: splitFilter,
                onChange: setSplitFilter,
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'split', label: 'In split' },
                  { value: 'nosplit', label: 'Not split' },
                ],
              },
              {
                id: 'total',
                label: 'In total',
                value: totalFilter,
                onChange: setTotalFilter,
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'counted', label: 'Counted' },
                  { value: 'excluded', label: 'Excluded' },
                ],
              },
            ]}
          />

          <div className="expenses-mobile-list">
            {pagedExpenses.map((e) => (
              <ExpenseSwipeRow
                key={e.id}
                expense={e}
                amountLabel={fmt(e.amountInr)}
                metaLine={expenseMetaLine(e)}
                onEdit={() =>
                  setEditing({
                    ...e,
                    countInTotal: e.countInTotal !== false,
                    splitEnabled: e.splitEnabled !== false,
                    splitExcludedPersonIds: e.splitExcludedPersonIds || [],
                  })
                }
                onDelete={() => confirmDeleteExpense(e)}
                onToggleCountInTotal={(checked) => setExpenseCountInTotal(e.id, checked)}
              />
            ))}
          </div>

          <div className="expenses-table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="expenses-total-col">In total</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Paid by</th>
                  <th>Split</th>
                  <th>Payment</th>
                  <th>From balance</th>
                  <th>Funded by</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.length === 0 && (
                  <tr>
                    <td colSpan={11} className="expenses-empty">
                      {focusName
                        ? `No expenses for ${focusName} yet. Say “${focusName} spent 200 cash for dinner on 24th” in Log expense.`
                        : 'No expenses yet. Anyone can log for the group — e.g. “Sanket spent 200 cash for dinner on 24th”.'}
                    </td>
                  </tr>
                )}
                {pagedExpenses.map((e) => {
                  const counted = expenseCountsInTotal(e);
                  const splitOn = expenseIsSplit(e);
                  const { participants, excluded } = participantsForExpense(e, snap.members);
                  const share =
                    splitOn && participants.length > 0
                      ? Math.round(e.amountInr / participants.length)
                      : 0;
                  return (
                    <tr key={e.id} className={counted ? undefined : 'expense-row-excluded'}>
                      <td className="expenses-total-col">
                        <label className="expense-total-check">
                          <input
                            type="checkbox"
                            checked={counted}
                            aria-label={`Count ${e.description} in total`}
                            onChange={(event) => setExpenseCountInTotal(e.id, event.target.checked)}
                          />
                          <span>{counted ? 'Yes' : 'No'}</span>
                        </label>
                      </td>
                      <td>{e.dateLabel}</td>
                      <td>{e.description}</td>
                      <td>{e.category}</td>
                      <td className="expenses-amt">{fmt(e.amountInr)}</td>
                      <td><strong>{e.paidByName}</strong></td>
                      <td>
                        {splitOn ? (
                          <span className="expense-split-badge" title={excluded.map((m) => m.name).join(', ') || 'Everyone'}>
                            {excluded.length === 0 ? `All · ${fmt(share)} each` : `${participants.length} · ${fmt(share)} each`}
                          </span>
                        ) : (
                          <span className="expense-split-off">No split</span>
                        )}
                      </td>
                      <td>{paymentLabel(e.paymentMethod)}</td>
                      <td>
                        {e.spentFromBalance ? (
                          <span className="expense-badge-balance">
                            Yes · {e.balanceHolderName || e.paidByName}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{e.givenByName || '—'}</td>
                      <td className="expenses-actions">
                        <button
                          type="button"
                          className="expense-action-edit"
                          aria-label="Edit"
                          onClick={() =>
                            setEditing({
                              ...e,
                              countInTotal: e.countInTotal !== false,
                              splitEnabled: e.splitEnabled !== false,
                              splitExcludedPersonIds: e.splitExcludedPersonIds || [],
                            })
                          }
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className="expense-action-delete"
                          aria-label="Delete"
                          onClick={() => confirmDeleteExpense(e)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {visibleExpenses.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4}><strong>Grand total (checked rows)</strong></td>
                    <td className="expenses-amt"><strong>{fmt(total)}</strong></td>
                    <td colSpan={6} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {visibleExpenses.length > 0 && (
            <div className="expenses-pagination" role="navigation" aria-label="Expense pages">
              <span className="expenses-pagination-meta">
                {expensePageStart + 1}–{expenseRangeEnd} of {visibleExpenses.length}
                <span className="expenses-pagination-page"> · Page {safeExpensePage} / {expensePageCount}</span>
              </span>
              <div className="expenses-pagination-controls">
                <button
                  type="button"
                  className="expenses-page-btn"
                  disabled={safeExpensePage <= 1}
                  aria-label="Previous page"
                  onClick={() => setExpensePage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                {Array.from({ length: expensePageCount }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`expenses-page-num${page === safeExpensePage ? ' is-active' : ''}`}
                    aria-label={`Page ${page}`}
                    aria-current={page === safeExpensePage ? 'page' : undefined}
                    onClick={() => setExpensePage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="expenses-page-btn"
                  disabled={safeExpensePage >= expensePageCount}
                  aria-label="Next page"
                  onClick={() => setExpensePage((p) => Math.min(expensePageCount, p + 1))}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <TravellerLedgerPanel
          members={focusMember ? [focusMember] : snap.members}
          transfers={snap.transfers}
          expenses={snap.expenses}
        />
      </div>

      <ExpenseSpendBlocks
        members={snap.members}
        expenses={visibleExpenses}
        focusName={focusName}
        onEdit={(e) =>
          setEditing({
            ...e,
            countInTotal: e.countInTotal !== false,
            splitEnabled: e.splitEnabled !== false,
            splitExcludedPersonIds: e.splitExcludedPersonIds || [],
          })
        }
        onDelete={confirmDeleteExpense}
      />

      <ExpenseSplitPanel members={snap.members} expenses={snap.expenses} focusName={focusName} />

      {manualOpen && manual && (
        <div className="assistant-settings-backdrop" onClick={() => setManualOpen(false)}>
          <div className="expense-edit-modal expense-edit-modal-wide" onClick={(ev) => ev.stopPropagation()}>
            <h3>Add expense manually</h3>
            <div className="expense-edit-grid">
              <label>
                Date label
                <input
                  value={manual.dateLabel}
                  onChange={(e) => setManual({ ...manual, dateLabel: e.target.value })}
                  placeholder="25 Dec"
                />
              </label>
              <label>
                Description
                <input
                  value={manual.description}
                  onChange={(e) => setManual({ ...manual, description: e.target.value })}
                  placeholder="Dinner / train ticket / …"
                />
              </label>
              <label>
                Category
                <select
                  value={manual.category}
                  onChange={(e) => setManual({ ...manual, category: e.target.value })}
                >
                  {['Food', 'Stay', 'Transport', 'Activity', 'Shopping', 'Other'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount (INR)
                <input
                  type="number"
                  min={0}
                  value={manual.amountInr || ''}
                  onChange={(e) => setManual({ ...manual, amountInr: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label>
                Paid by
                <select
                  value={manual.paidByPersonId}
                  onChange={(e) => {
                    const m = snap.members.find((x) => x.id === e.target.value);
                    setManual({
                      ...manual,
                      paidByPersonId: e.target.value,
                      paidByName: m?.name || manual.paidByName,
                      splitExcludedPersonIds: (manual.splitExcludedPersonIds || []).filter((id) => id !== e.target.value),
                    });
                  }}
                >
                  {snap.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment
                <select
                  value={manual.paymentMethod}
                  onChange={(e) => setManual({ ...manual, paymentMethod: e.target.value as PaymentMethod })}
                >
                  <option value="unknown">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </label>
            </div>
            <div className="expense-edit-checks">
              <label className="expense-check-label">
                <input
                  type="checkbox"
                  checked={manual.countInTotal}
                  onChange={(e) => setManual({ ...manual, countInTotal: e.target.checked })}
                />
                Add to group / member totals
              </label>
              <label className="expense-check-label">
                <input
                  type="checkbox"
                  checked={manual.splitEnabled}
                  onChange={(e) => setManual({ ...manual, splitEnabled: e.target.checked })}
                />
                Split equally among travellers
              </label>
            </div>
            {manual.splitEnabled && (
              <div className="expense-split-exclude">
                <div className="expense-split-exclude-label">Exclude from this spend</div>
                <p className="expense-split-exclude-hint">
                  Check names who should not share this bill.
                </p>
                <div className="expense-split-exclude-grid">
                  {snap.members.map((m) => {
                    const excluded = manual.splitExcludedPersonIds.includes(m.id);
                    const isPayer = m.id === manual.paidByPersonId;
                    return (
                      <label key={m.id} className={`expense-check-label${isPayer ? ' is-payer' : ''}`}>
                        <input
                          type="checkbox"
                          checked={excluded}
                          disabled={isPayer}
                          onChange={(e) => {
                            const current = new Set(manual.splitExcludedPersonIds);
                            if (e.target.checked) current.add(m.id);
                            else current.delete(m.id);
                            setManual({ ...manual, splitExcludedPersonIds: [...current] });
                          }}
                        />
                        {m.name}
                        {isPayer ? ' (payer)' : ''}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="expense-edit-actions">
              <button type="button" className="button pale" onClick={() => setManualOpen(false)}>Cancel</button>
              <button type="button" className="button dark" onClick={saveManual}>Save expense</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="assistant-settings-backdrop" onClick={() => setEditing(null)}>
          <div className="expense-edit-modal expense-edit-modal-wide" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit expense</h3>
            <div className="expense-edit-grid">
              <label>
                Date label
                <input
                  value={editing.dateLabel}
                  onChange={(e) => setEditing({ ...editing, dateLabel: e.target.value })}
                />
              </label>
              <label>
                Description
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                >
                  {['Food', 'Stay', 'Transport', 'Activity', 'Shopping', 'Other'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount (INR)
                <input
                  type="number"
                  min={0}
                  value={editing.amountInr}
                  onChange={(e) => setEditing({ ...editing, amountInr: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label>
                Paid by
                <select
                  value={editing.paidByPersonId}
                  onChange={(e) => {
                    const m = snap.members.find((x) => x.id === e.target.value);
                    setEditing({
                      ...editing,
                      paidByPersonId: e.target.value,
                      paidByName: m?.name || editing.paidByName,
                    });
                  }}
                >
                  {snap.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment
                <select
                  value={editing.paymentMethod}
                  onChange={(e) => setEditing({ ...editing, paymentMethod: e.target.value as PaymentMethod })}
                >
                  <option value="unknown">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <label>
                Gave money to (optional)
                <select
                  value={editing.givenByPersonId || ''}
                  onChange={(e) => {
                    const m = snap.members.find((x) => x.id === e.target.value);
                    setEditing({
                      ...editing,
                      givenByPersonId: m?.id,
                      givenByName: m?.name,
                    });
                  }}
                >
                  <option value="">—</option>
                  {snap.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              {editing.spentFromBalance ? (
                <label>
                  Balance holder
                  <select
                    value={editing.balanceHolderPersonId || editing.paidByPersonId}
                    onChange={(e) => {
                      const m = snap.members.find((x) => x.id === e.target.value);
                      setEditing({
                        ...editing,
                        balanceHolderPersonId: e.target.value,
                        balanceHolderName: m?.name || editing.balanceHolderName,
                      });
                    }}
                  >
                    {snap.members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="expense-edit-grid-spacer" aria-hidden />
              )}
            </div>
            <div className="expense-edit-checks">
              <label className="expense-check-label">
                <input
                  type="checkbox"
                  checked={editing.countInTotal !== false}
                  onChange={(e) => setEditing({ ...editing, countInTotal: e.target.checked })}
                />
                Add to group / member totals
              </label>
              <label className="expense-check-label">
                <input
                  type="checkbox"
                  checked={editing.splitEnabled !== false}
                  onChange={(e) => setEditing({ ...editing, splitEnabled: e.target.checked })}
                />
                Split equally among travellers
              </label>
              <label className="expense-check-label">
                <input
                  type="checkbox"
                  checked={editing.spentFromBalance}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      spentFromBalance: e.target.checked,
                      balanceHolderPersonId: e.target.checked
                        ? editing.balanceHolderPersonId || editing.paidByPersonId
                        : undefined,
                      balanceHolderName: e.target.checked
                        ? editing.balanceHolderName || editing.paidByName
                        : undefined,
                    })
                  }
                />
                Deduct from balance pool
              </label>
            </div>
            {editing.splitEnabled !== false && (
              <div className="expense-split-exclude">
                <div className="expense-split-exclude-label">Exclude from this spend</div>
                <p className="expense-split-exclude-hint">
                  Unchecked = in the split. Check a name to leave them out.
                </p>
                <div className="expense-split-exclude-grid">
                  {snap.members.map((m) => {
                    const excluded = (editing.splitExcludedPersonIds || []).includes(m.id);
                    const isPayer = m.id === editing.paidByPersonId;
                    return (
                      <label key={m.id} className={`expense-check-label${isPayer ? ' is-payer' : ''}`}>
                        <input
                          type="checkbox"
                          checked={excluded}
                          disabled={isPayer}
                          title={isPayer ? 'Payer stays in the split' : undefined}
                          onChange={(e) => {
                            const current = new Set(editing.splitExcludedPersonIds || []);
                            if (e.target.checked) current.add(m.id);
                            else current.delete(m.id);
                            setEditing({ ...editing, splitExcludedPersonIds: [...current] });
                          }}
                        />
                        {m.name}
                        {isPayer ? ' (payer)' : ''}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="assistant-settings-actions expense-edit-actions">
              <button
                type="button"
                className="button expense-modal-delete"
                onClick={() => editing && confirmDeleteExpense(editing)}
              >
                Delete entry
              </button>
              <button type="button" className="button pale" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="button dark" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
