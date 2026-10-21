import React, { useEffect, useState } from 'react';
import { Mic, Pencil, Trash2, Download, Users, Wifi, WifiOff, Bot } from 'lucide-react';
import {
  ExpenseRecord,
  addExpense,
  addMember,
  deleteExpense,
  exportExpensesCsv,
  getExpenseState,
  grandTotal,
  removeMember,
  removePending,
  subscribeExpenses,
  totalsByMember,
  updateExpense,
} from './expenseStore';
import { parseExpenseUtterance } from './expenseParse';
import { loadGeminiConfig } from './geminiConfig';
import { openTripAssistant } from './assistantBridge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ExpensesSection() {
  const [snap, setSnap] = useState(getExpenseState());
  const [online, setOnline] = useState(navigator.onLine);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = () => setSnap(getExpenseState());

  useEffect(() => subscribeExpenses(refresh), []);
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
        const parsed = await parseExpenseUtterance(p.rawText, config, true);
        addExpense(parsed);
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
  const total = grandTotal();

  function addPerson() {
    addMember(newName);
    setNewName('');
    refresh();
  }

  function saveEdit() {
    if (!editing) return;
    updateExpense(editing.id, {
      tripDate: editing.tripDate,
      dateLabel: editing.dateLabel,
      description: editing.description,
      category: editing.category,
      amountInr: editing.amountInr,
      paidByPersonId: editing.paidByPersonId,
      paidByName: editing.paidByName,
      source: editing.source,
    });
    setEditing(null);
    refresh();
  }

  function downloadCsv() {
    const blob = new Blob([exportExpensesCsv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'winter-himachal-expenses.csv';
    a.click();
  }

  return (
    <section id="expenses" className="section expenses-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">GROUP TRIP MONEY</div>
          <h2>Shared expenses tally.</h2>
          <p>
            Add up to 10 travellers. Log spends by voice in the AI assistant or edit rows below. Data stays on this
            device; pending items sync when you’re back online.
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

      <div className="expenses-summary-grid">
        <article className="expenses-summary-card expenses-summary-total">
          <small>TOTAL SPENT</small>
          <strong>{fmt(total)}</strong>
          <span>{snap.expenses.length} entries</span>
        </article>
        {memberTotals.map(({ member, total: t }) => (
          <article key={member.id} className="expenses-summary-card">
            <small>{member.name.toUpperCase()}</small>
            <strong>{fmt(t)}</strong>
            <span>Paid by {member.name}</span>
          </article>
        ))}
      </div>

      <div className="expenses-table-wrap">
        <table className="expenses-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount (₹)</th>
              <th>Paid by</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {snap.expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="expenses-empty">
                  No expenses yet. Tap <b>Voice log expense</b> and say e.g. “25 December dinner 2000 Rahul”.
                </td>
              </tr>
            )}
            {snap.expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.dateLabel}</td>
                <td>{e.description}</td>
                <td>{e.category}</td>
                <td className="expenses-amt">{fmt(e.amountInr)}</td>
                <td><strong>{e.paidByName}</strong></td>
                <td className="expenses-actions">
                  <button type="button" aria-label="Edit" onClick={() => setEditing({ ...e })}>
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => {
                      deleteExpense(e.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {snap.expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Grand total</strong></td>
                <td className="expenses-amt"><strong>{fmt(total)}</strong></td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
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
            <div className="assistant-settings-actions">
              <button type="button" className="button pale" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="button dark" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
