import React, { useEffect, useMemo, useState } from 'react';
import {
  IndianRupee,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Users,
  PieChart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BUDGET_STORAGE_KEY,
  BudgetCategory,
  BudgetLine,
  categoryTotal,
  defaultBudgetCategories,
  grandTotal,
  lineTotal,
  newLineId,
} from './budgetData';

type StoredBudget = {
  categories: BudgetCategory[];
  travelers: number;
  tripTarget: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function loadStored(): StoredBudget | null {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBudget;
    if (!parsed?.categories?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export default function BudgetCalculator() {
  const [categories, setCategories] = useState<BudgetCategory[]>(() => loadStored()?.categories ?? defaultBudgetCategories);
  const [travelers, setTravelers] = useState(() => loadStored()?.travelers ?? 2);
  const [tripTarget, setTripTarget] = useState(() => loadStored()?.tripTarget ?? 0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const payload: StoredBudget = { categories, travelers, tripTarget };
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
  }, [categories, travelers, tripTarget]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.categories) {
        setCategories(e.detail.categories);
        if (e.detail.travelers) setTravelers(e.detail.travelers);
        if (e.detail.tripTarget !== undefined) setTripTarget(e.detail.tripTarget);
      }
    };
    window.addEventListener('budget-updated', handler);
    return () => window.removeEventListener('budget-updated', handler);
  }, []);

  const total = useMemo(() => grandTotal(categories), [categories]);
  const perPerson = travelers > 0 ? total / travelers : total;
  const vsTarget = tripTarget > 0 ? total - tripTarget : null;

  const categoryShares = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        title: c.title,
        amount: categoryTotal(c),
        pct: total > 0 ? (categoryTotal(c) / total) * 100 : 0,
      })),
    [categories, total],
  );

  function updateLine(catId: string, lineId: string, patch: Partial<BudgetLine>) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              lines: c.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
            },
      ),
    );
  }

  function addLine(catId: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              lines: [...c.lines, { id: newLineId(), label: 'Custom item', qty: 1, unitCost: 0 }],
            },
      ),
    );
  }

  function removeLine(catId: string, lineId: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId ? c : { ...c, lines: c.lines.filter((l) => l.id !== lineId) },
      ),
    );
  }

  function resetBudget() {
    if (!confirm('Reset all budget fields to the default trip template? This clears your saved amounts.')) return;
    setCategories(defaultBudgetCategories);
    setTripTarget(0);
    setTravelers(2);
    setCollapsed({});
  }

  async function copySummary() {
    const lines = [
      'SPITI TOUR 2026 — BUDGET SUMMARY',
      `Travelers: ${travelers}`,
      tripTarget > 0 ? `Trip target: ${fmt(tripTarget)}` : '',
      `Estimated total: ${fmt(total)}`,
      travelers > 0 ? `Per person: ${fmt(perPerson)}` : '',
      '',
      ...categories.map((c) => {
        const sub = categoryTotal(c);
        if (sub === 0) return null;
        const items = c.lines
          .filter((l) => lineTotal(l) > 0)
          .map((l) => `  • ${l.label}: ${l.qty} × ${fmt(l.unitCost)} = ${fmt(lineTotal(l))}`);
        return [`${c.title}: ${fmt(sub)}`, ...items].join('\n');
      }).filter(Boolean),
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('Budget summary copied');
    } catch {
      alert(text);
    }
  }

  function toggleCat(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section id="budget" className="section budget-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">PLAN YOUR SPEND</div>
          <h2>Trip budget calculator.</h2>
          <p>
            Enter quantity and unit cost for each line (total = qty × ₹). Amounts sync to the cloud and share across all devices.
            Match nights, tickets, and days to your actual bookings.
          </p>
        </div>
        <div className="budget-head-actions">
          <button type="button" className="button pale" onClick={copySummary}>
            <Copy size={15} /> Copy summary
          </button>
          <button type="button" className="button pale" onClick={resetBudget}>
            <RotateCcw size={15} /> Reset template
          </button>
        </div>
      </div>

      <div className="budget-summary-grid">
        <article className="budget-summary-card budget-summary-main">
          <IndianRupee />
          <small>ESTIMATED TRIP TOTAL</small>
          <strong>{fmt(total)}</strong>
          <span>Sum of all categories below</span>
        </article>
        <article className="budget-summary-card">
          <Users />
          <small>PER PERSON</small>
          <div className="budget-travelers">
            <button
              type="button"
              aria-label="Fewer travelers"
              onClick={() => setTravelers((t) => Math.max(1, t - 1))}
            >
              −
            </button>
            <strong>{travelers}</strong>
            <button type="button" aria-label="More travelers" onClick={() => setTravelers((t) => t + 1)}>
              +
            </button>
          </div>
          <span>{fmt(perPerson)} each</span>
        </article>
        <article className="budget-summary-card">
          <PieChart />
          <small>TRIP TARGET (OPTIONAL)</small>
          <label className="budget-target-input">
            <span>₹</span>
            <input
              type="number"
              min={0}
              step={500}
              value={tripTarget || ''}
              placeholder="0"
              onChange={(e) => setTripTarget(parseNum(e.target.value))}
            />
          </label>
          {vsTarget !== null && (
            <span className={vsTarget > 0 ? 'budget-over' : 'budget-under'}>
              {vsTarget > 0 ? `${fmt(vsTarget)} over target` : `${fmt(-vsTarget)} under target`}
            </span>
          )}
          {tripTarget === 0 && <span>Set a cap to compare</span>}
        </article>
      </div>

      {total > 0 && (
        <div className="budget-breakdown-bar" aria-hidden="true">
          {categoryShares
            .filter((s) => s.amount > 0)
            .map((s) => (
              <div
                key={s.id}
                className="budget-breakdown-segment"
                style={{ flexGrow: s.amount, flexBasis: 0 }}
                title={`${s.title}: ${fmt(s.amount)} (${s.pct.toFixed(0)}%)`}
              />
            ))}
        </div>
      )}

      <div className="budget-categories">
        {categories.map((cat) => {
          const sub = categoryTotal(cat);
          const isClosed = collapsed[cat.id];
          return (
            <article key={cat.id} className="budget-category">
              <header className="budget-category-head">
                <button type="button" className="budget-category-toggle" onClick={() => toggleCat(cat.id)}>
                  {isClosed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
                <div className="budget-category-titles">
                  <h3>{cat.title}</h3>
                  <p>{cat.subtitle}</p>
                </div>
                <div className="budget-category-sub">{fmt(sub)}</div>
              </header>
              {!isClosed && (
                <div className="budget-table-wrap">
                  <table className="budget-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit (₹)</th>
                        <th>Line total</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {cat.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <input
                              className="budget-label-input"
                              value={line.label}
                              onChange={(e) => updateLine(cat.id, line.id, { label: e.target.value })}
                            />
                            {line.hint && <span className="budget-hint">{line.hint}</span>}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="budget-num-input"
                              value={line.qty || ''}
                              placeholder="0"
                              onChange={(e) => updateLine(cat.id, line.id, { qty: parseNum(e.target.value) })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              className="budget-num-input"
                              value={line.unitCost || ''}
                              placeholder="0"
                              onChange={(e) => updateLine(cat.id, line.id, { unitCost: parseNum(e.target.value) })}
                            />
                          </td>
                          <td className="budget-line-total">{fmt(lineTotal(line))}</td>
                          <td>
                            <button
                              type="button"
                              className="budget-remove"
                              aria-label="Remove line"
                              onClick={() => removeLine(cat.id, line.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="budget-add-line" onClick={() => addLine(cat.id)}>
                    <Plus size={14} /> Add line item
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="alert budget-note">
        <IndianRupee />
        <p>
          <b>Planning only.</b> Qty can mean nights, tickets, days, or people — use whatever matches how you quote
          prices. Winter road closures or NYE rates can change costs; keep your emergency buffer line updated.
        </p>
      </div>
    </section>
  );
}
