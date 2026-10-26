import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  Clock3,
  CreditCard,
  Pencil,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ExpenseRecord, TripMember } from './expenseStore';
import { buildExpenseSplitDetail, expenseIsSplit } from './expenseSplit';
import ListFilterBar from './ListFilterBar';
import ListPager, { pageSlice } from './ListPager';
import { ExpenseCategoryIcon, getExpenseCategoryMeta } from './expenseCategoryIcons';

const SPEND_PAGE_SIZE = 9;
const DETAIL_OWES_PAGE = 6;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const CATEGORY_ORDER = ['Food', 'Stay', 'Transport', 'Activity', 'Shopping', 'Other'];

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

type Props = {
  members: TripMember[];
  expenses: ExpenseRecord[];
  focusName?: string | null;
  onEdit?: (expense: ExpenseRecord) => void;
  onDelete?: (expense: ExpenseRecord) => void;
};

export default function ExpenseSpendBlocks({ members, expenses, focusName, onEdit, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [pageByCategory, setPageByCategory] = useState<Record<string, number>>({});
  const [owesPage, setOwesPage] = useState(1);

  useEffect(() => {
    setPageByCategory({});
  }, [search, categoryFilter, payerFilter, focusName]);

  useEffect(() => {
    setOwesPage(1);
  }, [openId]);

  const categories = useMemo(
    () => [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort(),
    [expenses],
  );

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = focusName
      ? expenses.filter((e) => {
          const inSplit =
            expenseIsSplit(e) &&
            members.some(
              (m) =>
                m.name.toLowerCase() === focusName.toLowerCase() &&
                !(e.splitExcludedPersonIds || []).includes(m.id),
            );
          return e.paidByName.toLowerCase() === focusName.toLowerCase() || inSplit;
        })
      : expenses;

    filtered = filtered.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (payerFilter !== 'all' && e.paidByPersonId !== payerFilter) return false;
      if (!q) return true;
      return `${e.description} ${e.category} ${e.paidByName} ${e.dateLabel}`.toLowerCase().includes(q);
    });

    const map = new Map<string, ExpenseRecord[]>();
    for (const e of filtered) {
      const key = e.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const keys = [
      ...CATEGORY_ORDER.filter((c) => map.has(c)),
      ...[...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
    ];
    return keys.map((category) => ({
      category,
      items: (map.get(category) || []).slice().sort((a, b) => b.createdAt - a.createdAt),
      total: (map.get(category) || []).reduce((s, e) => s + e.amountInr, 0),
    }));
  }, [expenses, focusName, members, search, categoryFilter, payerFilter]);

  const openExpense = openId ? expenses.find((e) => e.id === openId) : undefined;
  const openDetail = openExpense ? buildExpenseSplitDetail(openExpense, members) : null;

  if (!expenses.length) return null;

  return (
    <section className="expense-spend-blocks">
      <div className="expense-spend-blocks-head">
        <h3>Spend compartments</h3>
        <p className="traveller-ledger-hint">
          Each block is a logged spend. Click a card for place/date, when it was logged, who is in the split, and who owes
          the payer.
        </p>
      </div>

      <ListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search spend cards…"
        resultCount={grouped.reduce((n, g) => n + g.items.length, 0)}
        resultLabel="spends"
        onClear={() => {
          setSearch('');
          setCategoryFilter('all');
          setPayerFilter('all');
        }}
        filters={[
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
            id: 'payer',
            label: 'Paid by',
            value: payerFilter,
            onChange: setPayerFilter,
            options: [
              { value: 'all', label: 'All payers' },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ],
          },
        ]}
      />

      {grouped.length === 0 ? (
        <p className="traveller-ledger-empty">No spends in this filter yet.</p>
      ) : (
        grouped.map((group) => {
          const page = pageByCategory[group.category] || 1;
          const paged = pageSlice(group.items, page, SPEND_PAGE_SIZE);
          return (
            <div
              key={group.category}
              className={`expense-spend-category expense-spend-category-${getExpenseCategoryMeta(group.category).tone}`}
            >
              <div className="expense-spend-category-head">
                <h4>
                  <ExpenseCategoryIcon category={group.category} size={18} />
                  <span>{group.category}</span>
                </h4>
                <span>
                  {group.items.length} · {fmt(group.total)}
                </span>
              </div>
              <div className="expense-spend-grid">
                {paged.slice.map((e) => {
                  const detail = buildExpenseSplitDetail(e, members);
                  const share = detail?.shares[0]?.shareInr;
                  const cat = getExpenseCategoryMeta(e.category);
                  return (
                    <div key={e.id} className="expense-spend-card-wrap">
                      <button
                        type="button"
                        className={`expense-spend-card expense-spend-card-${cat.tone}`}
                        onClick={() => setOpenId(e.id)}
                      >
                        <span className="expense-spend-card-top">
                          <span className="expense-spend-card-date">{e.dateLabel}</span>
                          <ExpenseCategoryIcon category={e.category} size={14} className="expense-spend-card-cat" />
                        </span>
                        <strong className="expense-spend-card-title">{e.description}</strong>
                        <span className="expense-spend-card-amt">{fmt(e.amountInr)}</span>
                        <span className="expense-spend-card-meta">
                          Paid by {e.paidByName}
                          {detail
                            ? ` · ${detail.participants.length} split · ${fmt(share || 0)} each`
                            : ' · not split'}
                        </span>
                        {detail && detail.excluded.length > 0 && (
                          <span className="expense-spend-card-excl">
                            Excl. {detail.excluded.map((m) => m.name).join(', ')}
                          </span>
                        )}
                      </button>
                      {(onEdit || onDelete) && (
                        <div className="expense-spend-card-actions">
                          {onEdit && (
                            <button
                              type="button"
                              className="expense-spend-card-action"
                              aria-label={`Edit ${e.description}`}
                              title="Edit"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onEdit(e);
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="expense-spend-card-action is-danger"
                              aria-label={`Delete ${e.description}`}
                              title="Delete"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onDelete(e);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <ListPager
                page={paged.safePage}
                pageCount={paged.pageCount}
                total={group.items.length}
                pageSize={SPEND_PAGE_SIZE}
                label={`${group.category} spends`}
                onChange={(next) =>
                  setPageByCategory((prev) => ({ ...prev, [group.category]: next }))
                }
              />
            </div>
          );
        })
      )}

      {openExpense && (() => {
        const cat = getExpenseCategoryMeta(openExpense.category);
        const payLabel =
          openExpense.paymentMethod === 'cash'
            ? 'Cash'
            : openExpense.paymentMethod === 'online'
              ? 'Online'
              : 'Unspecified';
        const shareEach = openDetail?.shares[0]?.shareInr || 0;
        const owes = openDetail?.owesToPayer || [];
        const pagedOwes = pageSlice(owes, owesPage, DETAIL_OWES_PAGE);
        return (
          <div className="assistant-settings-backdrop" onClick={() => setOpenId(null)}>
            <div
              className={`expense-detail-modal expense-detail-modal-${cat.tone}`}
              onClick={(ev) => ev.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-detail-title"
            >
              <header className="expense-detail-hero">
                <div className="expense-detail-hero-main">
                  <ExpenseCategoryIcon category={openExpense.category} size={22} className="expense-detail-hero-icon" />
                  <div className="expense-detail-hero-copy">
                    <p className="expense-settle-kicker">{openExpense.category}</p>
                    <h3 id="expense-detail-title">{openExpense.description}</h3>
                    <p className="expense-detail-sub">
                      <CalendarDays size={13} /> {openExpense.dateLabel}
                      {openExpense.tripDate ? ` · ${openExpense.tripDate}` : ''}
                    </p>
                  </div>
                </div>
                <div className="expense-detail-hero-amt">
                  <small>Total</small>
                  <strong>{fmt(openExpense.amountInr)}</strong>
                </div>
                <button
                  type="button"
                  className="expense-detail-close"
                  aria-label="Close"
                  onClick={() => setOpenId(null)}
                >
                  <X size={16} />
                </button>
              </header>

              <div className="expense-detail-stats">
                <article className="expense-detail-stat">
                  <span className="expense-settle-avatar is-sm" aria-hidden>
                    {openExpense.paidByName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <small>Paid by</small>
                    <strong>{openExpense.paidByName}</strong>
                  </div>
                </article>
                <article className="expense-detail-stat">
                  {openExpense.paymentMethod === 'online' ? <CreditCard size={16} /> : <Banknote size={16} />}
                  <div>
                    <small>Payment</small>
                    <strong>{payLabel}</strong>
                  </div>
                </article>
                <article className="expense-detail-stat">
                  <Users size={16} />
                  <div>
                    <small>Split</small>
                    <strong>
                      {openDetail
                        ? `${openDetail.participants.length} · ${fmt(shareEach)} each`
                        : 'Off'}
                    </strong>
                  </div>
                </article>
                <article className="expense-detail-stat">
                  <Sparkles size={16} />
                  <div>
                    <small>Source</small>
                    <strong>{openExpense.source || '—'}</strong>
                  </div>
                </article>
              </div>

              <div className="expense-detail-meta-row">
                <span>
                  <Clock3 size={13} /> Logged {formatLoggedAt(openExpense.createdAt)}
                </span>
                <span>
                  <Clock3 size={13} /> Updated {formatLoggedAt(openExpense.updatedAt)}
                </span>
              </div>

              <section className="expense-detail-people">
                <div className="expense-detail-people-block">
                  <h4>Included</h4>
                  <div className="expense-detail-chips">
                    {openDetail?.participants.length ? (
                      openDetail.participants.map((m) => (
                        <span key={m.id} className="expense-detail-chip">
                          <b aria-hidden>{m.name.slice(0, 1).toUpperCase()}</b>
                          {m.name}
                        </span>
                      ))
                    ) : (
                      <span className="expense-detail-chip is-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="expense-detail-people-block">
                  <h4>Excluded</h4>
                  <div className="expense-detail-chips">
                    {openDetail?.excluded.length ? (
                      openDetail.excluded.map((m) => (
                        <span key={m.id} className="expense-detail-chip is-excl">
                          <b aria-hidden>{m.name.slice(0, 1).toUpperCase()}</b>
                          {m.name}
                        </span>
                      ))
                    ) : (
                      <span className="expense-detail-chip is-muted">None</span>
                    )}
                  </div>
                </div>
              </section>

              {owes.length > 0 && (
                <section className="expense-detail-owes">
                  <header className="expense-detail-owes-head">
                    <div>
                      <p className="expense-settle-kicker">Settlement</p>
                      <h4>Amount to give {openExpense.paidByName}</h4>
                      <p>Each share for this bill</p>
                    </div>
                    <span className="expense-settle-count">{owes.length}</span>
                  </header>
                  <ul className="expense-detail-owes-list">
                    {pagedOwes.slice.map((o) => (
                      <li key={o.member.id} className="expense-detail-owe-row">
                        <div className="expense-detail-owe-who">
                          <span className="expense-settle-avatar is-sm" aria-hidden>
                            {o.member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{o.member.name}</strong>
                            <small>
                              To be given to {openExpense.paidByName} for {openExpense.description}
                            </small>
                          </div>
                        </div>
                        <strong className="expense-detail-owe-amt">{fmt(o.amountInr)}</strong>
                      </li>
                    ))}
                  </ul>
                  <ListPager
                    page={pagedOwes.safePage}
                    pageCount={pagedOwes.pageCount}
                    total={owes.length}
                    pageSize={DETAIL_OWES_PAGE}
                    label="owes"
                    onChange={setOwesPage}
                  />
                </section>
              )}

              <div className="expense-detail-actions">
                {onDelete && (
                  <button
                    type="button"
                    className="button pale expense-modal-delete"
                    onClick={() => {
                      onDelete(openExpense);
                      setOpenId(null);
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    className="button pale"
                    onClick={() => {
                      onEdit(openExpense);
                      setOpenId(null);
                    }}
                  >
                    <Pencil size={14} /> Edit split
                  </button>
                )}
                <button type="button" className="button dark" onClick={() => setOpenId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
