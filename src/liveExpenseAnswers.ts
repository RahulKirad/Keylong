import { getExpenseState, grandTotal } from './expenseStore';
import { buildTravellerLedger, memberBalanceRemaining } from './expenseLedger';
import {
  buildNetBalances,
  buildPaySummaries,
  buildReceiveSummaries,
  buildSummedPairDebts,
  outstandingBetweenSimple,
  simplifySettlements,
} from './expenseSplit';
import { listTravellerNames, personFromQuestion } from './travellerBrief';

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findNamedPeople(text: string): string[] {
  const names = listTravellerNames().slice().sort((a, b) => b.length - a.length);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const re = new RegExp(`\\b${escapeName(name)}(?:['’]s)?\\b`, 'i');
    if (re.test(text) && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      found.push(name);
    }
  }
  return found;
}

/** Questions about who owes / should receive money from split bills. */
export function wantsLiveExpenseAnswer(question: string): boolean {
  const q = question.trim().toLowerCase();
  if (!q) return false;
  // Don't steal logging / settlement-recording utterances.
  if (
    /\b(i have given|i gave|have paid|marked paid|log expense|spent \d|paid \d|gave \d)\b/i.test(q) &&
    !/\?/.test(question) &&
    !/^(who|what|how|show|tell|list|do i|does|did)\b/i.test(q)
  ) {
    return false;
  }
  return (
    /\b(owe|owes|owing|owed|debt|debts|settle|settlement|settle[- ]?up|to receive|to be received|receivable|should receive|should pay|who should pay|who owes|how much .{0,40}owe|how much .{0,40}receive|pending (payment|amount|debt)|net balance|splitwise|bill split|splits?)\b/i.test(
      q,
    ) ||
    /\b(do i owe|does \w+ owe|what do i owe|what does \w+ owe|who owes me|who owes \w+|money (due|pending)|pending from)\b/i.test(
      q,
    )
  );
}

/** Compact authoritative snapshot injected into the Gemini system prompt. */
export function buildLiveExpenseDebtDocument(): string {
  const { members, expenses, settlements } = getExpenseState();
  const pairs = buildSummedPairDebts(expenses, members, settlements || []);
  const nets = buildNetBalances(expenses, members, settlements || []);
  const settle = simplifySettlements(nets);
  const receive = buildReceiveSummaries(expenses, members, settlements || []);
  const pay = buildPaySummaries(expenses, members, settlements || []);
  const total = grandTotal();

  const pairLines = pairs.length
    ? pairs.map(
        (p) =>
          `  - ${p.from.name} owes ${p.to.name}: ₹${p.amountInr}` +
          (p.parts.length > 1
            ? ` (from ${p.parts.map((x) => `${x.description} ₹${x.amountInr}`).join('; ')})`
            : p.parts[0]
              ? ` (${p.parts[0].description})`
              : ''),
      )
    : ['  - none pending'];

  const netLines = nets.map((n) => {
    if (n.netInr > 0) return `  - ${n.member.name}: +₹${n.netInr} (should RECEIVE)`;
    if (n.netInr < 0) return `  - ${n.member.name}: −₹${Math.abs(n.netInr)} (should PAY / OWES)`;
    return `  - ${n.member.name}: ₹0 (settled)`;
  });

  const settleLines = settle.length
    ? settle.map((s) => `  - ${s.from.name} → ${s.to.name}: ₹${s.amountInr}`)
    : ['  - none (all clear or no splits)'];

  const receiveLines = receive.length
    ? receive.map(
        (r) =>
          `  - ${r.member.name} should receive ₹${r.totalToReceiveInr} from: ${r.fromDebtors
            .map((d) => `${d.member.name} ₹${d.amountInr}`)
            .join(', ')}`,
      )
    : ['  - nobody is owed right now'];

  const payLines = pay.length
    ? pay.map(
        (p) =>
          `  - ${p.member.name} should pay ₹${p.totalToPayInr} to: ${p.toCreditors
            .map((c) => `${c.member.name} ₹${c.amountInr}`)
            .join(', ')}`,
      )
    : ['  - nobody owes right now'];

  return `
LIVE SPLITWISE DEBTS (authoritative — use EXACT ₹ amounts; never invent or round differently):
Group counted spend total: ₹${total}
Outstanding pair debts (after mark-paid settlements):
${pairLines.join('\n')}
Net positions (+ receive / − owe):
${netLines.join('\n')}
Suggested fewest settle-up payments:
${settleLines.join('\n')}
Who should RECEIVE (to be received):
${receiveLines.join('\n')}
Who should PAY (owing):
${payLines.join('\n')}
When asked who owes / how much to receive / settle-up, answer ONLY from this block with exact names and amounts.
`.trim();
}

export function formatLiveExpenseReply(question: string, speakerName: string): string {
  const { members, expenses, transfers, settlements } = getExpenseState();
  const settles = settlements || [];
  const pairs = buildSummedPairDebts(expenses, members, settles);
  const nets = buildNetBalances(expenses, members, settles);
  const settleUp = simplifySettlements(nets);
  const receiveAll = buildReceiveSummaries(expenses, members, settles);
  const payAll = buildPaySummaries(expenses, members, settles);
  const q = question.trim().toLowerCase();
  const named = findNamedPeople(question);
  const subjectName = personFromQuestion(question, speakerName);
  const subject = members.find((m) => m.name.toLowerCase() === subjectName.toLowerCase());
  const speaker = members.find((m) => m.name.toLowerCase() === speakerName.toLowerCase());

  // Pair: "how much does A owe B"
  if (named.length >= 2) {
    const fromName = named[0];
    const toName = named[1];
    const from = members.find((m) => m.name.toLowerCase() === fromName.toLowerCase());
    const to = members.find((m) => m.name.toLowerCase() === toName.toLowerCase());
    if (from && to && /\b(owe|owes|owing|debt|pending|pay|give|receive)\b/i.test(q)) {
      const aToB = outstandingBetweenSimple(expenses, members, settles, from.id, to.id);
      const bToA = outstandingBetweenSimple(expenses, members, settles, to.id, from.id);
      const lines: string[] = ['**Exact pending between them** (from live bill splits):', ''];
      if (aToB > 0) lines.push(`• **${from.name}** owes **${to.name}** **${inr(aToB)}**`);
      if (bToA > 0) lines.push(`• **${to.name}** owes **${from.name}** **${inr(bToA)}**`);
      if (aToB <= 0 && bToA <= 0) {
        lines.push(`• Nothing pending between **${from.name}** and **${to.name}**.`);
      }
      const pairParts = pairs.find((p) => p.from.id === from.id && p.to.id === to.id);
      if (pairParts?.parts.length) {
        lines.push('', '**Included bills**');
        for (const part of pairParts.parts) {
          lines.push(`• ${part.dateLabel} — ${part.description}: **${inr(part.amountInr)}**`);
        }
      }
      return lines.join('\n');
    }
  }

  const wantsReceive =
    /\b(receive|receivable|to be received|owed to me|owes me|who owes|should (i |we )?get|coming (to|back)|get back)\b/i.test(
      q,
    );
  const wantsPay =
    /\b(owe|owes|owing|should (i |we )?pay|have to pay|need to pay|pending (payment|debt)|debt)\b/i.test(q) &&
    !wantsReceive;
  const wantsSettleAll =
    /\b(settle[- ]?up|who should pay whom|everyone|all (debts|owes|balances)|full (debt|owe)|group (debt|owe|settle))\b/i.test(
      q,
    ) ||
    (/who owes whom/.test(q) && !named.length);

  if (wantsSettleAll || (!named.length && /\b(who owes|settle|net)\b/i.test(q) && !/\b(me|i|my)\b/i.test(q))) {
    const lines: string[] = ['**Live settle-up** (exact amounts from split bills − mark-paid):', ''];
    if (!settleUp.length && !pairs.length) {
      lines.push('• Nobody owes anyone right now — splits are clear or no split bills yet.');
    } else {
      if (settleUp.length) {
        lines.push('**Fewest payments to clear nets**');
        for (const s of settleUp) {
          lines.push(`• **${s.from.name}** → **${s.to.name}**: **${inr(s.amountInr)}**`);
        }
        lines.push('');
      }
      if (pairs.length) {
        lines.push('**Outstanding by person pair**');
        for (const p of pairs) {
          lines.push(`• **${p.from.name}** owes **${p.to.name}**: **${inr(p.amountInr)}**`);
        }
      }
      lines.push('', '**Net position** (+ to receive / − to pay)');
      for (const n of nets) {
        if (n.netInr === 0) continue;
        lines.push(
          n.netInr > 0
            ? `• **${n.member.name}**: should receive **${inr(n.netInr)}**`
            : `• **${n.member.name}**: owes **${inr(Math.abs(n.netInr))}**`,
        );
      }
    }
    return lines.join('\n');
  }

  // Focused on one traveller (speaker or named)
  const focus = subject || speaker;
  if (!focus) {
    return 'No traveller matched. Sign in with your name, then ask again who owes or who should receive.';
  }
  const self = focus.name.toLowerCase() === speakerName.toLowerCase();
  const who = focus.name;
  const payRow = payAll.find((p) => p.member.id === focus.id);
  const recvRow = receiveAll.find((r) => r.member.id === focus.id);
  const net = nets.find((n) => n.member.id === focus.id)?.netInr ?? 0;
  const poolLeft = memberBalanceRemaining(focus.id, transfers, expenses);

  // Pure pool-balance ask without owe language
  if (/\b(balance left|money left|pool)\b/i.test(q) && !/\b(owe|receive|settle|debt)\b/i.test(q)) {
    const ledger = buildTravellerLedger(members, transfers, expenses).find((r) => r.member.id === focus.id);
    return [
      self ? `**Your pool balance**` : `**${who}'s pool balance**`,
      '',
      `• Balance left to spend from handovers: **${inr(poolLeft)}**`,
      ledger ? `• Paid as payer on trip: **${inr(ledger.totalSpentAsPayer)}**` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const lines: string[] = [
    self ? `**Your exact money position** (live splits)` : `**${who}'s exact money position** (live splits)`,
    '',
  ];

  if (wantsReceive || (!wantsPay && net >= 0)) {
    if (recvRow && recvRow.totalToReceiveInr > 0) {
      lines.push(`• **To be received:** **${inr(recvRow.totalToReceiveInr)}**`);
      for (const d of recvRow.fromDebtors) {
        lines.push(`  · from **${d.member.name}**: **${inr(d.amountInr)}**`);
      }
    } else if (wantsReceive) {
      lines.push(`• **To be received:** **${inr(0)}** — nobody currently owes ${self ? 'you' : who}.`);
    }
  }

  if (wantsPay || (!wantsReceive && net <= 0) || (!wantsReceive && !wantsPay)) {
    if (payRow && payRow.totalToPayInr > 0) {
      lines.push(`• **Still owing:** **${inr(payRow.totalToPayInr)}**`);
      for (const c of payRow.toCreditors) {
        lines.push(`  · to **${c.member.name}**: **${inr(c.amountInr)}**`);
      }
    } else if (wantsPay || !wantsReceive) {
      lines.push(`• **Still owing:** **${inr(0)}** — ${self ? 'you are' : `${who} is`} clear on split bills.`);
    }
  }

  if (!wantsReceive && !wantsPay) {
    if (recvRow && recvRow.totalToReceiveInr > 0 && !(payRow && payRow.totalToPayInr > 0)) {
      // already covered
    } else if (recvRow && recvRow.totalToReceiveInr > 0 && lines.every((l) => !l.includes('To be received'))) {
      lines.push(`• **To be received:** **${inr(recvRow.totalToReceiveInr)}**`);
      for (const d of recvRow.fromDebtors) {
        lines.push(`  · from **${d.member.name}**: **${inr(d.amountInr)}**`);
      }
    }
  }

  lines.push(
    '',
    net > 0
      ? `• **Net:** should receive **${inr(net)}** overall`
      : net < 0
        ? `• **Net:** owes **${inr(Math.abs(net))}** overall`
        : `• **Net:** **${inr(0)}** (settled)`,
  );

  if (poolLeft !== 0) {
    lines.push(`• Pool / handover balance left: **${inr(poolLeft)}**`);
  }

  lines.push(
    '',
    'Amounts match **Spiti Tour Expenses → Bill splits**. Mark paid in chat (“I have given … to …”) to clear a debt.',
  );
  return lines.join('\n');
}
