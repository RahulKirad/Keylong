import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Wallet } from 'lucide-react';
import type { ExpenseRecord, FundTransfer, PaymentMethod, TripMember } from './expenseStore';
import { addFundTransfer, getExpenseState } from './expenseStore';
import {
  buildPoolManagerSummaries,
  getPoolManagerIds,
  setPoolManagerSlot,
  subscribePoolManagers,
  type PoolManagerSummary,
} from './poolManagers';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type Props = {
  members: TripMember[];
  transfers: FundTransfer[];
  expenses: ExpenseRecord[];
  onChanged?: () => void;
};

export default function PoolManagersBoard({ members, transfers, expenses, onChanged }: Props) {
  const [managerTick, setManagerTick] = useState(0);
  useEffect(() => subscribePoolManagers(() => setManagerTick((n) => n + 1)), []);

  const managerIds = useMemo(() => getPoolManagerIds(members), [members, managerTick]);
  const pools = useMemo(
    () => buildPoolManagerSummaries(members, transfers, expenses),
    [members, transfers, expenses, managerTick],
  );

  /** Always two slots so names can be edited even before both are chosen. */
  const slots: Array<{ slot: number; pool: PoolManagerSummary | null; personId: string }> = [0, 1].map(
    (slot) => {
      const personId = managerIds[slot] || '';
      const pool = pools.find((p) => p.member.id === personId) || null;
      return { slot, pool, personId };
    },
  );

  const [open, setOpen] = useState<PoolManagerSummary | null>(null);
  const [contribFromId, setContribFromId] = useState('');
  const [contribAmount, setContribAmount] = useState(20000);
  const [contribPay, setContribPay] = useState<PaymentMethod>('cash');
  const titleNames = slots
    .map((s) => s.pool?.member.name)
    .filter(Boolean)
    .join(' & ');

  function openPool(pool: PoolManagerSummary) {
    const others = members.filter((m) => m.id !== pool.member.id);
    setContribFromId(others[0]?.id || '');
    setContribAmount(20000);
    setContribPay('cash');
    setOpen(pool);
  }

  function changeSlot(slot: number, personId: string) {
    if (!personId) return;
    setPoolManagerSlot(slot, personId, members);
    onChanged?.();
  }

  function saveContribution() {
    if (!open || !contribFromId || contribAmount <= 0) return;
    const from = members.find((m) => m.id === contribFromId);
    if (!from) return;
    try {
      addFundTransfer({
        tripDate: new Date().toISOString().slice(0, 10),
        dateLabel: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        fromPersonId: from.id,
        fromPersonName: from.name,
        toPersonId: open.member.id,
        toPersonName: open.member.name,
        amountInr: Math.round(contribAmount),
        paymentMethod: contribPay,
        note: 'Trip pool contribution',
        source: 'manual',
      });
      onChanged?.();
      const next = buildPoolManagerSummaries(
        getExpenseState().members,
        getExpenseState().transfers,
        getExpenseState().expenses,
      ).find((p) => p.member.id === open.member.id);
      if (next) setOpen(next);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not record contribution.');
    }
  }

  if (!members.length) {
    return (
      <section className="pool-managers-board">
        <header className="pool-managers-head">
          <Wallet size={18} aria-hidden />
          <div>
            <p className="expense-settle-kicker">Shared trip float</p>
            <h3>Pool managers</h3>
            <p>Add travellers first, then choose who holds the shared balance.</p>
          </div>
        </header>
      </section>
    );
  }

  return (
    <>
      <section className="pool-managers-board" aria-label="Shared trip pools">
        <header className="pool-managers-head">
          <Wallet size={18} aria-hidden />
          <div>
            <p className="expense-settle-kicker">Shared trip float</p>
            <h3>Collected with {titleNames || 'pool managers'}</h3>
            <p>
              Travellers give a basic amount (e.g. ₹20,000) to these managers. Use the name dropdowns to change who
              holds each pool. Tap a card for who gave how much.
            </p>
          </div>
        </header>
        <div className="pool-managers-grid">
          {slots.map(({ slot, pool, personId }) => (
            <div
              key={`slot-${slot}`}
              className={`pool-manager-card${slot === 1 ? ' is-sanket' : ' is-rahul'}`}
            >
              <div className="pool-manager-card-top">
                <span className="expense-settle-avatar" aria-hidden>
                  {(pool?.member.name || '?').slice(0, 1).toUpperCase()}
                </span>
                <div className="pool-manager-name-edit">
                  <small>
                    <Pencil size={10} aria-hidden /> Pool manager {slot + 1}
                  </small>
                  <select
                    className="pool-manager-name-select"
                    value={personId}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => changeSlot(slot, e.target.value)}
                    aria-label={`Choose pool manager ${slot + 1}`}
                  >
                    <option value="">Select traveller…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {pool ? (
                <button type="button" className="pool-manager-card-body" onClick={() => openPool(pool)}>
                  <div className="pool-manager-stats">
                    <div>
                      <small>Collected</small>
                      <em>{fmt(pool.collectedInr)}</em>
                    </div>
                    <div>
                      <small>Spent from pool</small>
                      <em>{fmt(pool.spentInr)}</em>
                    </div>
                    <div className="is-remain">
                      <small>Balance left</small>
                      <em>{fmt(pool.remainingInr)}</em>
                    </div>
                  </div>
                  <span className="pool-manager-tap">
                    {pool.contributions.length
                      ? `${pool.contributions.length} contributor${pool.contributions.length === 1 ? '' : 's'} · tap for details`
                      : 'Tap to see who gave · or record a contribution'}
                  </span>
                </button>
              ) : (
                <p className="pool-manager-empty-slot">Choose a traveller above to track their shared pool.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {open && (
        <div className="assistant-settings-backdrop" onClick={() => setOpen(null)}>
          <div
            className="expense-edit-modal expense-edit-modal-wide pool-detail-modal"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3>{open.member.name}&apos;s shared pool</h3>
            <p className="pool-detail-lead">
              Collected <b>{fmt(open.collectedInr)}</b> · spent from pool <b>{fmt(open.spentInr)}</b> ·{' '}
              <b className={open.remainingInr < 0 ? 'ledger-warn' : 'ledger-balance'}>
                {fmt(open.remainingInr)} left
              </b>
            </p>

            <h4 className="pool-detail-title">Who gave how much</h4>
            {open.contributions.length === 0 ? (
              <p className="pool-detail-empty">
                No contributions yet. Record one below or say in chat: “Milind gave 20000 to {open.member.name} cash”.
              </p>
            ) : (
              <ul className="pool-contrib-list">
                {open.contributions.map((c) => (
                  <li key={c.fromPersonId}>
                    <span className="expense-settle-avatar is-sm" aria-hidden>
                      {c.fromPersonName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{c.fromPersonName}</strong>
                      <small>
                        {c.transferCount} transfer{c.transferCount === 1 ? '' : 's'}
                      </small>
                    </div>
                    <em>{fmt(c.amountInr)}</em>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="pool-detail-title">Spent from this pool</h4>
            {open.spends.length === 0 ? (
              <p className="pool-detail-empty">
                No pool spends yet. When logging an expense you can choose to minus it from this balance.
              </p>
            ) : (
              <ul className="pool-spend-list">
                {open.spends.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.description}</strong>
                      <small>
                        {s.dateLabel} · paid by {s.paidByName}
                      </small>
                    </div>
                    <em>{fmt(s.amountInr)}</em>
                  </li>
                ))}
              </ul>
            )}

            <div className="pool-contrib-form">
              <h4 className="pool-detail-title">Record contribution</h4>
              <div className="expense-edit-grid">
                <label>
                  From traveller
                  <select value={contribFromId} onChange={(e) => setContribFromId(e.target.value)}>
                    {members
                      .filter((m) => m.id !== open.member.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Amount (INR)
                  <input
                    type="number"
                    min={0}
                    value={contribAmount || ''}
                    onChange={(e) => setContribAmount(parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Payment
                  <select
                    value={contribPay}
                    onChange={(e) => setContribPay(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="unknown">Not specified</option>
                  </select>
                </label>
              </div>
              <button type="button" className="button dark" onClick={saveContribution}>
                Add to {open.member.name}&apos;s pool
              </button>
            </div>

            <div className="expense-edit-actions">
              <button type="button" className="button pale" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
