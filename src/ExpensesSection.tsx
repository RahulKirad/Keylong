import React, { useEffect, useState } from 'react';
import { Mic, Pencil, Trash2, Download, Users, Wifi, WifiOff, Bot } from 'lucide-react';
import {
  ExpenseRecord,
  FundTransfer,
  PaymentMethod,
  addExpense,
  addFundTransfer,
  addMember,
  deleteExpense,
  deleteFundTransfer,
  exportExpensesCsv,
  getExpenseState,
  removeMember,
  removePending,
  subscribeExpenses,
  totalsByMember,
  updateExpense,
} from './expenseStore';
import { parseMoneyUtterance } from './expenseParse';
import { loadGeminiConfig } from './geminiConfig';
import { openTripAssistant } from './assistantBridge';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import ExpenseSwipeRow from './ExpenseSwipeRow';
import TravellerLedgerPanel from './TravellerLedgerPanel';

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
  return parts.filter((p) => p !== '—').join(' · ') || '—';
}

type ExpensesSectionProps = {
  standalone?: boolean;
};

function samePerson(value: string | undefined, name: string): boolean {
  return (value || '').trim().toLowerCase() === name.trim().toLowerCase();
}

export default function ExpensesSection({ standalone = false }: ExpensesSectionProps) {
  const [snap, setSnap] = useState(getExpenseState());
  const [online, setOnline] = useState(navigator.onLine);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [focusName, setFocusName] = useState<string | null>(() => getSelectedTraveller());

  const refresh = () => setSnap(getExpenseState());

  useEffect(() => subscribeExpenses(refresh), []);
  useEffect(() => subscribeSelectedTraveller(setFocusName), []);
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
  const visibleExpenses = focusName
    ? snap.expenses.filter(
        (expense) =>
          samePerson(expense.paidByName, focusName) ||
          samePerson(expense.balanceHolderName, focusName) ||
          samePerson(expense.givenByName, focusName),
      )
    : snap.expenses;
  const visibleTransfers = focusName
    ? snap.transfers.filter(
        (transfer) =>
          samePerson(transfer.fromPersonName, focusName) || samePerson(transfer.toPersonName, focusName),
      )
    : snap.transfers;
  const visibleTotals = focusName
    ? memberTotals.filter(({ member }) => samePerson(member.name, focusName))
    : memberTotals;
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amountInr, 0);

  function addPerson() {
    addMember(newName);
    setNewName('');
    refresh();
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
    a.download = 'winter-himachal-expenses.csv';
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
          <h2>{standalone ? 'Winter Himachal Expenses' : 'Shared expenses tally.'}</h2>
          <p>
            {focusName
              ? `Showing money for ${focusName}. Log expense records new spends as paid by ${focusName}.`
              : 'Pick a traveller. Expenses and Log expense then follow that name.'}
          </p>
        </div>
        <div className="expenses-status">
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'Online' : 'Offline — saved locally'}
          {snap.pending.length > 0 && (
            <span className="expenses-pending">{snap.pending.length} pending parse</span>
          )}
        </div>
      </div>

      <div className="assistant-name-row expenses-focus-row assistant-name-locked">
        <span className="assistant-name-label">{focusName ? 'Showing your money' : 'Unlock and pick your name first'}</span>
        {focusName && (
          <button type="button" className="on" disabled>
            {focusName}
          </button>
        )}
      </div>

      <div className="expenses-toolbar">
        <button type="button" className="button dark" onClick={() => openTripAssistant('expense')}>
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
        <div className="expenses-member-chips">
          {snap.members.map((m) => (
            <span key={m.id} className="expense-chip">
              {m.name}
              <button type="button" aria-label={`Remove ${m.name}`} onClick={() => { removeMember(m.id); refresh(); }}>
                ×
              </button>
            </span>
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
              <small>{focusName ? `${focusName.toUpperCase()} SPENT` : 'TOTAL SPENT'}</small>
              <strong>{fmt(total)}</strong>
              <span>{visibleExpenses.length} entries</span>
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

          <p className="expenses-delete-hint">Wrong entry? Swipe left on mobile or tap <b>Delete</b> in the table.</p>

          <div className="expenses-mobile-list">
            {visibleExpenses.map((e) => (
              <ExpenseSwipeRow
                key={e.id}
                expense={e}
                amountLabel={fmt(e.amountInr)}
                metaLine={expenseMetaLine(e)}
                onEdit={() => setEditing({ ...e })}
                onDelete={() => confirmDeleteExpense(e)}
              />
            ))}
          </div>

          <div className="expenses-table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Paid by</th>
                  <th>Payment</th>
                  <th>From balance</th>
                  <th>Funded by</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="expenses-empty">
                      {focusName
                        ? `No expenses for ${focusName} yet. In Log expense, say “25 Dec dinner 2000 cash”.`
                        : 'Pick a traveller above, then log an expense in their name.'}
                    </td>
                  </tr>
                )}
                {visibleExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.dateLabel}</td>
                    <td>{e.description}</td>
                    <td>{e.category}</td>
                    <td className="expenses-amt">{fmt(e.amountInr)}</td>
                    <td><strong>{e.paidByName}</strong></td>
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
                      <button type="button" className="expense-action-edit" aria-label="Edit" onClick={() => setEditing({ ...e })}>
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
                ))}
              </tbody>
              {visibleExpenses.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Grand total</strong></td>
                    <td className="expenses-amt"><strong>{fmt(total)}</strong></td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <TravellerLedgerPanel
          members={focusMember ? [focusMember] : snap.members}
          transfers={snap.transfers}
          expenses={snap.expenses}
        />
      </div>

      {editing && (
        <div className="assistant-settings-backdrop" onClick={() => setEditing(null)}>
          <div className="expense-edit-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit expense</h3>
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
              Deduct from traveller’s balance pool
            </label>
            {editing.spentFromBalance && (
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
            )}
            <label>
              Gave money to (optional note)
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
            <div className="assistant-settings-actions">
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
