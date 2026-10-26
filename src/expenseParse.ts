import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';
import { isOverloadError } from './geminiClient';
import {
  DebtSettlementInput,
  ExpenseInput,
  FundTransferInput,
  PaymentMethod,
  addMember,
  findMemberByName,
  getExpenseState,
  parseDateFromText,
} from './expenseStore';
import { outstandingBetweenSimple } from './expenseSplit';
import { getDays } from './itineraryStore';

export type ParsedExpense = ExpenseInput & { kind: 'expense' };
export type ParsedGiveMoney = FundTransferInput & { kind: 'give' };
export type ParsedSettleDebt = DebtSettlementInput & { kind: 'settle' };
export type ParsedMoneyAction = ParsedExpense | ParsedGiveMoney | ParsedSettleDebt;

const MONEY_JSON_INSTRUCTION = `You extract ONE money action from the user's message for a Spiti Tour 2026 group trip.
Known travellers (use exact name if match): {{MEMBERS}}
Trip days: {{DAYS}}

Reply with ONLY valid JSON (no markdown). Use action "give" OR "expense" OR "settle":

For giving cash to hold (pool / balance):
{"action":"give","amountInr":number,"dateLabel":"e.g. 25 Dec","tripDate":"YYYY-MM-DD","fromPersonName":"who paid out","toPersonName":"who receives to spend","paymentMethod":"cash|online|unknown","note":"optional"}

For a purchase / spend:
{"action":"expense","description":"string","category":"Food|Stay|Transport|Activity|Shopping|Other","amountInr":number,"dateLabel":"e.g. 25 Dec","tripDate":"YYYY-MM-DD","paidByName":"who paid at shop","paymentMethod":"cash|online|unknown","spentFromBalance":boolean,"balanceHolderName":"whose pool balance to deduct (if spentFromBalance)","givenByName":"optional who originally gave them the cash","splitEnabled":true,"excludedPersonNames":["names to leave OUT of the equal split"]}

For clearing a split debt (paid back / settled share):
{"action":"settle","amountInr":numberOr0,"fromPersonName":"who owed and is paying","toPersonName":"who should receive","note":"optional what for e.g. train travel","paymentMethod":"cash|online|unknown"}
If amount unknown, set amountInr to 0 (app will use remaining pending).

Rules:
- "Rahul gave 5000 to Sanket cash" → action give, from Rahul, to Sanket, cash. (pool money, NOT settle)
- "I have given the amount of train travel to Sanket" → action settle, to Sanket, note train travel, amountInr 0.
- "Paid Sanket for dinner" / "cleared my share to Rahul" / "settled with Sanket" → settle.
- "Sanket spent 2000 dinner from balance cash" → expense, paidBy Sanket, spentFromBalance true, balanceHolderName Sanket, cash.
- "Sanket has done the expense of 200 rs through cash for dinner on 24th" → expense, paidBy Sanket (NOT the speaker), cash, Food, 24 Dec.
- "25 dec dinner 2000 rahul online" → expense, paidBy Rahul, not from balance, online.
- "Sanket spent 17500 on dinner exclude Allen, Piyu and Rutika" → expense, paidBy Sanket, splitEnabled true, excludedPersonNames ["Allen","Piyu","Rutika"]. Split among everyone else.
- Phrases that mean exclude: exclude / excluding / except / without / don't include / do not include / not including / leave out / skip.
- If NO exclude/don't-include language → excludedPersonNames must be [] (split among all travellers).
- Spends are on behalf of the group by default → splitEnabled true unless user says "don't split" / "personal" / "only for me".
- Prefer settle when user says paid back / cleared / settled / given the amount of X to Y (repaying a bill share).
- Prefer give when handing cash for someone to hold/spend later ("gave 5000 to Sanket cash").
- Anyone may log another traveller’s spend by saying that traveller’s name. Prefer the named spender over the person typing.
- amountInr integer INR only (0 allowed for settle).
- If payment not stated use unknown. Map UPI/GPay/card/phonepe → online.`;

function parsePaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();
  if (/\b(online|upi|gpay|google pay|phonepe|paytm|card|netbanking|neft|imps)\b/.test(lower)) return 'online';
  if (/\bcash\b/.test(lower)) return 'cash';
  return 'unknown';
}

function parseSpentFromBalance(text: string): boolean {
  return /\b(from balance|using balance|spent from balance|out of balance|from pool|using pool)\b/i.test(text);
}

function parseSplitDisabled(text: string): boolean {
  return /\b(don'?t split|do not split|no split|personal(?:\s+only)?|only for me|myself only|not for the group)\b/i.test(
    text,
  );
}

/** Pull names after exclude / don't include / except / without / leave out / skip. */
export function extractExcludedNameHints(text: string): string[] {
  const patterns = [
    /\b(?:exclude|excluding|except(?:ing)?|without|leave\s+out|skip)\s+([^.!?\n]+)/i,
    /\b(?:don'?t|do\s+not)\s+include\s+([^.!?\n]+)/i,
    /\bnot\s+including\s+([^.!?\n]+)/i,
  ];
  const hints: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const chunk = match[1]
      .replace(/\b(?:from\s+(?:this|the)\s+(?:expense|bill|spend|split)|for\s+this)\b.*$/i, '')
      .trim();
    const parts = chunk
      .split(/\s*(?:,|&|\/|\+|and)\s*/i)
      .map((p) => p.replace(/[^A-Za-z\s'-]/g, '').trim())
      .filter((p) => p.length >= 2);
    hints.push(...parts);
  }
  return [...new Set(hints.map((h) => h.toLowerCase()))];
}

export function resolveExcludedPersonIds(text: string, payerId?: string): string[] {
  const hints = extractExcludedNameHints(text);
  if (!hints.length) return [];
  const { members } = getExpenseState();
  const ids: string[] = [];
  for (const hint of hints) {
    const member =
      members.find((m) => m.name.toLowerCase() === hint) ||
      members.find((m) => m.name.toLowerCase().startsWith(hint)) ||
      members.find((m) => hint.startsWith(m.name.toLowerCase()) || m.name.toLowerCase().includes(hint));
    if (member && member.id !== payerId) ids.push(member.id);
  }
  return [...new Set(ids)];
}

function resolveExcludedFromNames(names: unknown, payerId?: string): string[] {
  if (!Array.isArray(names)) return [];
  const ids: string[] = [];
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const member = resolveMember(name);
    if (member && member.id !== payerId) ids.push(member.id);
  }
  return [...new Set(ids)];
}

function stripExcludePhrases(text: string): string {
  return text
    .replace(/\b(?:exclude|excluding|except(?:ing)?|without|leave\s+out|skip)\s+[^.!?\n]+/gi, ' ')
    .replace(/\b(?:don'?t|do\s+not)\s+include\s+[^.!?\n]+/gi, ' ')
    .replace(/\bnot\s+including\s+[^.!?\n]+/gi, ' ')
    .replace(/\b(don'?t split|do not split|no split|personal(?:\s+only)?|only for me)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractAmount(text: string): number {
  const amountMatch =
    text.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d[\d,]*)/i) || text.match(/(\d[\d,]*)\s*(?:₹|rs\.?|inr|rupees?)/i);
  if (amountMatch) return parseInt(amountMatch[1].replace(/,/g, ''), 10);
  const bare = text.match(/\b(\d{3,7})\b/);
  return bare ? parseInt(bare[1], 10) : NaN;
}

function resolveMember(name: string): { id: string; name: string } | undefined {
  let member = findMemberByName(name);
  if (!member && name) member = addMember(name) || undefined;
  return member;
}

function offlineParseGive(text: string): ParsedGiveMoney | null {
  const lower = text.toLowerCase();
  if (!/\b(gave|give|handed|passed|sent|transferred)\b/.test(lower)) return null;
  const toMatch = text.match(/\bto\s+([A-Za-z][A-Za-z\s]*?)(?:\s+(?:cash|online|upi)|$|,|\.)/i);
  if (!toMatch) return null;
  const amount = extractAmount(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let fromName = 'Unknown';
  const fromMatch = text.match(/\b([A-Za-z]+)\s+gave\b/i) || text.match(/\bgave\s+(?:by\s+)?([A-Za-z]+)\b/i);
  if (fromMatch) fromName = fromMatch[1];
  else {
    const { members } = getExpenseState();
    for (const m of members) {
      if (lower.includes(m.name.toLowerCase()) && m.name.toLowerCase() !== toMatch[1].trim().toLowerCase()) {
        fromName = m.name;
        break;
      }
    }
  }

  const toName = toMatch[1].trim();
  const from = resolveMember(fromName);
  const to = resolveMember(toName);
  if (!from || !to) return null;

  const date = parseDateFromText(text) || { tripDate: '2026-12-25', dateLabel: '25 Dec' };

  return {
    kind: 'give',
    tripDate: date.tripDate,
    dateLabel: date.dateLabel,
    fromPersonId: from.id,
    fromPersonName: from.name,
    toPersonId: to.id,
    toPersonName: to.name,
    amountInr: amount,
    paymentMethod: parsePaymentMethod(text),
    note: text.slice(0, 120),
    source: 'offline',
  };
}

/** Detect “Sanket spent / has done / paid …” style attribution. */
function namedSpenderFromText(text: string): string | null {
  const patterns = [
    /\b([A-Za-z][A-Za-z]+)\s+(?:has\s+)?(?:done|made|logged)\s+(?:an?\s+)?(?:expense|spend|payment|purchase)\b/i,
    /\b([A-Za-z][A-Za-z]+)\s+(?:spent|paid|bought|purchased)\b/i,
    /\b(?:expense|spend|payment)\s+(?:of|by|for)\s+([A-Za-z][A-Za-z]+)\b/i,
    /\b(?:by|paid by|spent by|for)\s+([A-Za-z][A-Za-z]+)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function offlineParseExpense(text: string): ParsedExpense | null {
  const amount = extractAmount(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = parseDateFromText(text) || { tripDate: '2026-12-25', dateLabel: '25 Dec' };
  const spentFromBalance = parseSpentFromBalance(text);
  const paymentMethod = parsePaymentMethod(text);

  let paidByName = 'Unassigned';
  const { members } = getExpenseState();
  const named = namedSpenderFromText(text);
  if (named) paidByName = named;
  else {
    for (const m of members) {
      if (text.toLowerCase().includes(m.name.toLowerCase())) {
        paidByName = m.name;
        break;
      }
    }
  }

  let givenByName: string | undefined;
  const givenMatch = text.match(/\b(?:money from|given by|from)\s+([A-Za-z]+)\b/i);
  if (givenMatch && !spentFromBalance) givenByName = givenMatch[1];

  const lower = text.toLowerCase();
  let category = 'Other';
  if (/dinner|lunch|breakfast|food|cafe|meal|tea/.test(lower)) category = 'Food';
  else if (/hotel|stay|room|guest/.test(lower)) category = 'Stay';
  else if (/taxi|cab|fuel|toll|transfer|train|flight/.test(lower)) category = 'Transport';
  else if (/shop|souvenir/.test(lower)) category = 'Shopping';

  let description = stripExcludePhrases(text)
    .replace(/(\d[\d,]*)\s*(?:₹|rs\.?|inr|rupees?)/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:dec|jan)\b/gi, '')
    .replace(/\b(from balance|using balance|cash|online|upi)\b/gi, '')
    .replace(/\b([A-Za-z]+)\s+(?:spent|paid|bought|purchased)\b/gi, '')
    .trim();
  if (description.length > 80) description = description.slice(0, 80);
  if (!description) description = category === 'Food' ? 'Meal' : 'Expense';

  let member = resolveMember(paidByName);
  if (!member && members[0]) {
    member = members[0];
    paidByName = member.name;
  }
  if (!member) {
    member = resolveMember(paidByName === 'Unassigned' ? 'Traveller 1' : paidByName);
    if (member) paidByName = member.name;
  }
  if (!member) return null;

  let givenByPersonId: string | undefined;
  if (givenByName) {
    const g = resolveMember(givenByName);
    if (g) {
      givenByPersonId = g.id;
      givenByName = g.name;
    }
  }

  const holder = member;
  const splitEnabled = !parseSplitDisabled(text);
  const splitExcludedPersonIds = splitEnabled ? resolveExcludedPersonIds(text, member.id) : [];

  return {
    kind: 'expense',
    tripDate: date.tripDate,
    dateLabel: date.dateLabel,
    description,
    category,
    amountInr: amount,
    paidByPersonId: member.id,
    paidByName: member.name,
    paymentMethod,
    spentFromBalance,
    balanceHolderPersonId: spentFromBalance ? holder.id : undefined,
    balanceHolderName: spentFromBalance ? holder.name : undefined,
    givenByPersonId,
    givenByName,
    splitEnabled,
    splitExcludedPersonIds,
    source: 'offline',
  };
}

function looksLikeSettle(text: string): boolean {
  return (
    /\b(settled|settle(?:d)?\s+up|cleared|clear(?:ed)?\s+my|paid\s+back|paid\s+my\s+share|repaid|paid\s+off|given\s+the\s+amount|have\s+given\s+the\s+amount|mark(?:ed)?\s+as\s+paid)\b/i.test(
      text,
    ) || /\bpaid\s+[A-Za-z]+\s+for\b/i.test(text)
  );
}

function extractSettleNote(text: string): string | undefined {
  const ofMatch = text.match(/\b(?:amount\s+of|for|towards|regarding)\s+([^.,\n]+?)(?:\s+to\s+[A-Za-z]|\s*$)/i);
  if (ofMatch?.[1]) {
    return ofMatch[1]
      .replace(/\b(cash|online|upi|rs\.?|inr|rupees?|\d[\d,]*)\b/gi, '')
      .trim()
      .slice(0, 80) || undefined;
  }
  return undefined;
}

function offlineParseSettle(text: string, actingAs?: string): ParsedSettleDebt | null {
  if (!looksLikeSettle(text)) return null;

  const toMatch =
    text.match(/\bto\s+([A-Za-z][A-Za-z]+)\b/i) ||
    text.match(/\bpaid\s+([A-Za-z][A-Za-z]+)\s+for\b/i) ||
    text.match(/\bwith\s+([A-Za-z][A-Za-z]+)\b/i) ||
    text.match(/\bcleared\s+(?:with\s+)?([A-Za-z][A-Za-z]+)\b/i);
  if (!toMatch?.[1]) return null;

  const to = resolveMember(toMatch[1]);
  if (!to) return null;

  let fromName = actingAs || '';
  const fromMatch =
    text.match(/\b([A-Za-z][A-Za-z]+)\s+(?:paid|cleared|settled|gave|given)\b/i) ||
    text.match(/\b(?:from)\s+([A-Za-z][A-Za-z]+)\b/i);
  if (fromMatch?.[1] && fromMatch[1].toLowerCase() !== to.name.toLowerCase()) {
    fromName = fromMatch[1];
  }
  if (!fromName || fromName.toLowerCase() === to.name.toLowerCase()) {
    fromName = actingAs || '';
  }
  const from = resolveMember(fromName);
  if (!from || from.id === to.id) return null;

  const note = extractSettleNote(text);
  const stated = extractAmount(text);
  const { expenses, members, settlements } = getExpenseState();
  const pending = outstandingBetweenSimple(
    expenses,
    members,
    settlements || [],
    from.id,
    to.id,
    note,
  );
  const amountInr =
    Number.isFinite(stated) && stated > 0 ? stated : pending;

  if (!amountInr || amountInr <= 0) {
    return null;
  }

  return {
    kind: 'settle',
    fromPersonId: from.id,
    fromPersonName: from.name,
    toPersonId: to.id,
    toPersonName: to.name,
    amountInr: Math.round(amountInr),
    note,
    paymentMethod: parsePaymentMethod(text),
    source: 'offline',
  };
}

function offlineParse(text: string, actingAs?: string): ParsedMoneyAction | null {
  return offlineParseSettle(text, actingAs) || offlineParseGive(text) || offlineParseExpense(text);
}

async function callGeminiExpenseJson(config: GeminiConfig, prompt: string): Promise<string> {
  const apiKey = config.apiKey.trim();
  const models = [config.model || DEFAULT_GEMINI_MODEL, ...GEMINI_MODEL_IDS];
  const unique = [...new Set(models)];

  for (const model of unique) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || '';
      if (isOverloadError(msg, res.status)) continue;
      throw new Error(msg || `Gemini error ${res.status}`);
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '';
    if (text.trim()) return text.trim();
  }
  throw new Error('Could not parse with AI.');
}

function normalizePaymentMethod(v: string | undefined): PaymentMethod {
  if (v === 'cash' || v === 'online') return v;
  return 'unknown';
}

function namesMentioned(text: string, except: string) {
  const lower = text.toLowerCase();
  return getExpenseState().members.filter((member) => {
    const name = member.name.toLowerCase();
    return name !== except.toLowerCase() && lower.includes(name);
  });
}

/**
 * Selected traveller is who is typing — not always who paid.
 * If another traveller is clearly named as spender/payer, keep that attribution
 * so Rahul can log “Sanket spent 200 cash for dinner”.
 */
function attributeToTraveller(
  action: ParsedMoneyAction,
  actingAs: string | undefined,
  text: string,
): ParsedMoneyAction {
  if (!actingAs?.trim()) return action;
  const actor = resolveMember(actingAs);
  if (!actor) return action;
  const others = namesMentioned(text, actor.name);
  const namedSpender = namedSpenderFromText(text);
  const namedSpenderMember = namedSpender ? resolveMember(namedSpender) : undefined;

  if (action.kind === 'settle') {
    // “I paid Sanket” while logged in as Rahul → from = Rahul unless another payer named.
    const namedFrom = namedSpenderMember && namedSpenderMember.id !== action.toPersonId
      ? namedSpenderMember
      : null;
    if (namedFrom && namedFrom.id !== actor.id && /\b(paid|cleared|settled)\b/i.test(text)) {
      return {
        ...action,
        fromPersonId: namedFrom.id,
        fromPersonName: namedFrom.name,
      };
    }
    if (action.fromPersonId && action.fromPersonId !== actor.id && namedFrom) return action;
    return {
      ...action,
      fromPersonId: actor.id,
      fromPersonName: actor.name,
    };
  }

  if (action.kind === 'give') {
    const received =
      /\b(gave|give|handed|sent|transferred)\b.{0,30}\b(me|myself)\b/i.test(text) ||
      /\b(to me|for me)\b/i.test(text);
    const fromOther = others.find((member) =>
      new RegExp(`\\b${member.name}\\b.{0,24}\\b(gave|give|handed|sent|transferred)\\b`, 'i').test(text),
    );
    if (received && fromOther) {
      return {
        ...action,
        fromPersonId: fromOther.id,
        fromPersonName: fromOther.name,
        toPersonId: actor.id,
        toPersonName: actor.name,
      };
    }
    // “Allen gave 5000 to Sanket” while logged in as Rahul → keep named parties.
    if (fromOther || (namedSpenderMember && namedSpenderMember.id !== actor.id)) {
      return action;
    }
    const recipient = others.find((member) => member.id !== actor.id);
    return {
      ...action,
      fromPersonId: actor.id,
      fromPersonName: actor.name,
      toPersonId: recipient?.id || action.toPersonId,
      toPersonName: recipient?.name || action.toPersonName,
    };
  }

  // Explicit other spender named → do not overwrite with the logged-in user.
  if (namedSpenderMember && namedSpenderMember.id !== actor.id) {
    return {
      ...action,
      paidByPersonId: namedSpenderMember.id,
      paidByName: namedSpenderMember.name,
      ...(action.spentFromBalance
        ? {
            balanceHolderPersonId: namedSpenderMember.id,
            balanceHolderName: namedSpenderMember.name,
          }
        : {}),
    };
  }

  // Parsed paidBy already a different traveller → keep it.
  if (action.paidByPersonId && action.paidByPersonId !== actor.id) {
    return action;
  }

  // No other name — default spend to the person logging.
  return {
    ...action,
    paidByPersonId: actor.id,
    paidByName: actor.name,
    ...(action.spentFromBalance
      ? { balanceHolderPersonId: actor.id, balanceHolderName: actor.name }
      : {}),
  };
}

export async function parseMoneyUtterance(
  text: string,
  config: GeminiConfig,
  online: boolean,
  actingAs?: string,
): Promise<ParsedMoneyAction> {
  const finish = (action: ParsedMoneyAction) => {
    const attributed = attributeToTraveller(action, actingAs, text);
    if (attributed.kind !== 'settle') return attributed;
    // Resolve 0 amount to remaining pending after attribution.
    if (attributed.amountInr > 0) return attributed;
    const { expenses, members, settlements } = getExpenseState();
    const pending = outstandingBetweenSimple(
      expenses,
      members,
      settlements || [],
      attributed.fromPersonId,
      attributed.toPersonId,
      attributed.note,
    );
    return { ...attributed, amountInr: pending };
  };
  const offline = offlineParse(text, actingAs);
  if (!online && offline) return finish(offline);
  if (!online) {
    throw new Error(
      'Offline: try "I have given the amount of train travel to Sanket" or "25 Dec dinner 2000 Rahul".',
    );
  }
  if (!config.apiKey.trim()) {
    if (offline) return finish(offline);
    throw new Error('Add Gemini API key in settings to parse complex entries.');
  }

  const { members } = getExpenseState();
  const memberNames = members.map((m) => m.name).join(', ') || '(none yet — infer name from speech)';
  const dayRef = getDays().map((d) => `Day ${d.day} ${d.date}`).join('; ');
  const speaker = actingAs
    ? `\nThe traveller typing is ${actingAs}. If another traveller is named as the spender/payer, set paidByName (or give from/to) to THAT person. Only default to ${actingAs} when no other traveller is clearly named. For settle, default fromPersonName to ${actingAs}.`
    : '';
  const prompt = `${MONEY_JSON_INSTRUCTION.replace('{{MEMBERS}}', memberNames).replace('{{DAYS}}', dayRef)}${speaker}\n\nUser said: "${text}"`;

  try {
    const raw = await callGeminiExpenseJson(config, prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action =
      parsed.action === 'give' ? 'give' : parsed.action === 'settle' ? 'settle' : 'expense';

    if (action === 'settle' || (looksLikeSettle(text) && parsed.action !== 'expense' && parsed.action !== 'give')) {
      const to = resolveMember(String(parsed.toPersonName || ''));
      const from = resolveMember(String(parsed.fromPersonName || actingAs || ''));
      if (!from || !to) throw new Error('Could not match travellers for settlement.');
      const note = parsed.note ? String(parsed.note) : extractSettleNote(text);
      return finish({
        kind: 'settle',
        fromPersonId: from.id,
        fromPersonName: from.name,
        toPersonId: to.id,
        toPersonName: to.name,
        amountInr: Math.round(Number(parsed.amountInr) || 0),
        note,
        paymentMethod: normalizePaymentMethod(String(parsed.paymentMethod || '')),
        source: 'ai',
      });
    }

    if (action === 'give') {
      const from = resolveMember(String(parsed.fromPersonName || actingAs || ''));
      const to = resolveMember(String(parsed.toPersonName || ''));
      if (!from || !to) throw new Error('Could not match traveller names for transfer.');
      const dateLabel = String(parsed.dateLabel || '25 Dec');
      return finish({
        kind: 'give',
        tripDate: String(parsed.tripDate || '2026-12-25'),
        dateLabel,
        fromPersonId: from.id,
        fromPersonName: from.name,
        toPersonId: to.id,
        toPersonName: to.name,
        amountInr: Math.round(Number(parsed.amountInr) || 0),
        paymentMethod: normalizePaymentMethod(String(parsed.paymentMethod || '')),
        note: parsed.note ? String(parsed.note) : undefined,
        source: 'ai',
      });
    }

    const paidByName = String(parsed.paidByName || namedSpenderFromText(text) || actingAs || 'Unassigned');
    let member = resolveMember(paidByName) || resolveMember(actingAs || '');
    if (!member) throw new Error('Add trip members on the Expenses page first.');

    const spentFromBalance = Boolean(parsed.spentFromBalance);
    let holder = member;
    if (spentFromBalance && parsed.balanceHolderName) {
      holder = resolveMember(String(parsed.balanceHolderName)) || member;
    }

    let givenByPersonId: string | undefined;
    let givenByName: string | undefined;
    if (parsed.givenByName) {
      const g = resolveMember(String(parsed.givenByName));
      if (g) {
        givenByPersonId = g.id;
        givenByName = g.name;
      }
    }

    const aiSplitOff =
      parsed.splitEnabled === false || parseSplitDisabled(text);
    const fromAi = resolveExcludedFromNames(parsed.excludedPersonNames, member.id);
    const fromText = resolveExcludedPersonIds(text, member.id);
    const splitExcludedPersonIds = aiSplitOff ? [] : [...new Set([...fromAi, ...fromText])];

    return finish({
      kind: 'expense',
      tripDate: String(parsed.tripDate || '2026-12-25'),
      dateLabel: String(parsed.dateLabel || '25 Dec'),
      description: stripExcludePhrases(String(parsed.description || 'Expense')),
      category: String(parsed.category || 'Other'),
      amountInr: Math.round(Number(parsed.amountInr) || 0),
      paidByPersonId: member.id,
      paidByName: member.name,
      paymentMethod: normalizePaymentMethod(String(parsed.paymentMethod || '')),
      spentFromBalance,
      balanceHolderPersonId: spentFromBalance ? holder.id : undefined,
      balanceHolderName: spentFromBalance ? holder.name : undefined,
      givenByPersonId,
      givenByName,
      splitEnabled: !aiSplitOff,
      splitExcludedPersonIds,
      source: 'ai',
    });
  } catch {
    if (offline) return finish(offline);
    throw new Error(
      'Could not understand. Try: "Sanket spent 17500 on dinner exclude Allen, Piyu and Rutika" or "Rahul gave 10000 to Sanket cash".',
    );
  }
}

/** @deprecated use parseMoneyUtterance */
export async function parseExpenseUtterance(
  text: string,
  config: GeminiConfig,
  online: boolean,
): Promise<ExpenseInput> {
  const action = await parseMoneyUtterance(text, config, online);
  if (action.kind === 'give') {
    throw new Error('This sounds like giving money to someone — say it in expense mode or include what was bought.');
  }
  if (action.kind === 'settle') {
    throw new Error('This sounds like clearing a debt — use Log expense chat with “paid …” / “given the amount …”.');
  }
  return action;
}
