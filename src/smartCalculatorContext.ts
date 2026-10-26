import { BUDGET_STORAGE_KEY, type BudgetCategory } from './budgetData';
import { getExpenseState, grandTotal, expenseCountsInTotal } from './expenseStore';
import {
  buildNetBalances,
  buildAllExpenseSplits,
  buildPaySummaries,
  buildReceiveSummaries,
  buildSummedPairDebts,
  simplifySettlements,
} from './expenseSplit';

export type CalcSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

function loadBudgetSummary(): { plannedTotal: number; tripTarget: number; travelers: number } {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return { plannedTotal: 0, tripTarget: 0, travelers: 0 };
    const data = JSON.parse(raw) as {
      categories?: BudgetCategory[];
      travelers?: number;
      tripTarget?: number;
    };
    const plannedTotal = (data.categories || []).reduce(
      (sum, cat) =>
        sum + cat.lines.reduce((s, line) => s + Math.max(0, line.qty) * Math.max(0, line.unitCost), 0),
      0,
    );
    return {
      plannedTotal,
      tripTarget: data.tripTarget || 0,
      travelers: data.travelers || 0,
    };
  } catch {
    return { plannedTotal: 0, tripTarget: 0, travelers: 0 };
  }
}

/** Compact live ledger snapshot for the smart calculator AI. */
export function buildTripSpendingContext(): string {
  const { members, expenses, transfers, settlements } = getExpenseState();
  const budget = loadBudgetSummary();
  const total = grandTotal();
  const counted = expenses.filter(expenseCountsInTotal);
  const byCategory = new Map<string, number>();
  const byPayer = new Map<string, number>();
  for (const e of counted) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amountInr);
    byPayer.set(e.paidByName, (byPayer.get(e.paidByName) || 0) + e.amountInr);
  }

  const splits = buildAllExpenseSplits(expenses, members);
  const balances = buildNetBalances(expenses, members, settlements || []);
  const settle = simplifySettlements(balances);
  const pairs = buildSummedPairDebts(expenses, members, settlements || []);
  const receive = buildReceiveSummaries(expenses, members, settlements || []);
  const pay = buildPaySummaries(expenses, members, settlements || []);

  const recent = [...counted]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((e) => {
      const excl = (e.splitExcludedPersonIds || []).length;
      return `- ${e.dateLabel} | ${e.description} | ${e.category} | ₹${e.amountInr} | paid by ${e.paidByName}${
        e.splitEnabled === false ? ' | no split' : excl ? ` | ${excl} excluded from split` : ' | split all'
      }`;
    });

  const lines = [
    'Spiti Tour 2026 — live expense context for calculations:',
    `Travellers (${members.length}): ${members.map((m) => m.name).join(', ') || '(none)'}`,
    `Group total spent (counted): ₹${total} across ${counted.length} expenses`,
    `Fund transfers logged: ${transfers.length}`,
    budget.tripTarget
      ? `Budget trip target: ₹${budget.tripTarget}; planned budget lines: ₹${budget.plannedTotal}; travelers setting: ${budget.travelers || members.length}`
      : `Planned budget lines total: ₹${budget.plannedTotal}; travelers setting: ${budget.travelers || members.length}`,
    'By category:',
    ...[...byCategory.entries()].map(([c, a]) => `  - ${c}: ₹${a}`),
    'By payer (paid at shop):',
    ...[...byPayer.entries()].map(([n, a]) => `  - ${n}: ₹${a}`),
    'Split net positions (+ should receive, − owes):',
    ...balances.map((b) => `  - ${b.member.name}: ₹${b.netInr}`),
    'Suggested settle-up:',
    ...(settle.length
      ? settle.map((s) => `  - ${s.from.name} → ${s.to.name}: ₹${s.amountInr}`)
      : ['  - none (settled or no splits)']),
    'Outstanding pair debts (exact):',
    ...(pairs.length
      ? pairs.map((p) => `  - ${p.from.name} owes ${p.to.name}: ₹${p.amountInr}`)
      : ['  - none']),
    'To be received:',
    ...(receive.length
      ? receive.map(
          (r) =>
            `  - ${r.member.name}: ₹${r.totalToReceiveInr} from ${r.fromDebtors
              .map((d) => `${d.member.name} ₹${d.amountInr}`)
              .join(', ')}`,
        )
      : ['  - none']),
    'Still owing:',
    ...(pay.length
      ? pay.map(
          (p) =>
            `  - ${p.member.name}: ₹${p.totalToPayInr} to ${p.toCreditors
              .map((c) => `${c.member.name} ₹${c.amountInr}`)
              .join(', ')}`,
        )
      : ['  - none']),
    `Split expenses tracked: ${splits.length}`,
    'Recent expenses:',
    ...(recent.length ? recent : ['  (none yet)']),
  ];
  return lines.join('\n');
}

export function buildCalcSuggestions(): CalcSuggestion[] {
  const { members, expenses } = getExpenseState();
  const total = grandTotal();
  const n = Math.max(1, members.length);
  const budget = loadBudgetSummary();
  const suggestions: CalcSuggestion[] = [
    {
      id: 'per-person',
      label: 'Per-person share of total',
      prompt: `What is each person's equal share of the group total spent (₹${total}) among ${n} travellers?`,
    },
    {
      id: 'remaining-budget',
      label: budget.tripTarget ? 'Left vs trip target' : 'Typical daily spend',
      prompt: budget.tripTarget
        ? `Trip target is ₹${budget.tripTarget} and we have spent ₹${total}. How much is left, and what is the remaining average per traveller?`
        : `Based on what we have spent so far (₹${total}), estimate a simple average spend per day for the remaining Spiti days and per traveller.`,
    },
  ];

  const topPayer = [...expenses.filter(expenseCountsInTotal)]
    .reduce<{ name: string; amount: number } | null>((best, e) => {
      if (!best || e.amountInr > best.amount) return { name: e.paidByName, amount: e.amountInr };
      return best;
    }, null);

  if (topPayer) {
    suggestions.push({
      id: 'top-spend',
      label: `${topPayer.name}'s big bill share`,
      prompt: `${topPayer.name} paid ₹${topPayer.amount} on a bill. How much does each included traveller owe them if it was split equally among the group (minus any exclusions already logged)?`,
    });
  }

  suggestions.push({
    id: 'settle',
    label: 'Who owes whom now?',
    prompt: 'Using the current Splitwise net balances, summarise who should pay whom and the amounts in INR.',
  });

  suggestions.push({
    id: 'food-vs-transport',
    label: 'Food vs transport',
    prompt: 'From logged expenses, compare Food vs Transport totals and say which is higher and by how much per person.',
  });

  return suggestions;
}

/** Safe arithmetic for classic calculator / quick math (no AI). */
export function tryEvalMathExpression(raw: string): number | null {
  let expr = raw
    .trim()
    .replace(/,/g, '')
    .replace(/₹|rs\.?|inr|rupees?/gi, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');
  if (!expr) return null;
  // percent: 200*10% → 200*0.1
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!/^[\d+\-*/().]+$/.test(expr)) return null;
  if (!/\d/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expr});`)() as unknown;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  } catch {
    return null;
  }
}
