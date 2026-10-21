import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';
import { isOverloadError } from './geminiClient';
import {
  ExpenseInput,
  FundTransferInput,
  PaymentMethod,
  addMember,
  findMemberByName,
  getExpenseState,
  parseDateFromText,
} from './expenseStore';
import { days } from './tripData';

export type ParsedExpense = ExpenseInput & { kind: 'expense' };
export type ParsedGiveMoney = FundTransferInput & { kind: 'give' };
export type ParsedMoneyAction = ParsedExpense | ParsedGiveMoney;

const MONEY_JSON_INSTRUCTION = `You extract ONE money action from the user's message for a Winter Himachal group trip.
Known travellers (use exact name if match): {{MEMBERS}}
Trip days: {{DAYS}}

Reply with ONLY valid JSON (no markdown). Use action "give" OR "expense":

For giving cash to hold (pool / balance):
{"action":"give","amountInr":number,"dateLabel":"e.g. 25 Dec","tripDate":"YYYY-MM-DD","fromPersonName":"who paid out","toPersonName":"who receives to spend","paymentMethod":"cash|online|unknown","note":"optional"}

For a purchase / spend:
{"action":"expense","description":"string","category":"Food|Stay|Transport|Activity|Shopping|Other","amountInr":number,"dateLabel":"e.g. 25 Dec","tripDate":"YYYY-MM-DD","paidByName":"who paid at shop","paymentMethod":"cash|online|unknown","spentFromBalance":boolean,"balanceHolderName":"whose pool balance to deduct (if spentFromBalance)","givenByName":"optional who originally gave them the cash"}

Rules:
- "Rahul gave 5000 to Sanket cash" → action give, from Rahul, to Sanket, cash.
- "Sanket spent 2000 dinner from balance cash" → expense, paidBy Sanket, spentFromBalance true, balanceHolderName Sanket, cash.
- "25 dec dinner 2000 rahul online" → expense, not from balance, online.
- amountInr integer INR only.
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

function offlineParseExpense(text: string): ParsedExpense | null {
  const amount = extractAmount(text);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = parseDateFromText(text) || { tripDate: '2026-12-25', dateLabel: '25 Dec' };
  const spentFromBalance = parseSpentFromBalance(text);
  const paymentMethod = parsePaymentMethod(text);

  let paidByName = 'Unassigned';
  const { members } = getExpenseState();
  const paidByMatch = text.match(/\b(?:by|paid by|spent by)\s+([A-Za-z]+)/i);
  if (paidByMatch) paidByName = paidByMatch[1];
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

  let description = text
    .replace(/(\d[\d,]*)\s*(?:₹|rs\.?|inr|rupees?)/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:dec|jan)\b/gi, '')
    .replace(/\b(from balance|using balance|cash|online|upi)\b/gi, '')
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
    source: 'offline',
  };
}

function offlineParse(text: string): ParsedMoneyAction | null {
  return offlineParseGive(text) || offlineParseExpense(text);
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

export async function parseMoneyUtterance(
  text: string,
  config: GeminiConfig,
  online: boolean,
): Promise<ParsedMoneyAction> {
  const offline = offlineParse(text);
  if (!online && offline) return offline;
  if (!online) {
    throw new Error('Offline: try "Rahul gave 5000 to Sanket cash" or "25 Dec dinner 2000 Rahul".');
  }
  if (!config.apiKey.trim()) {
    if (offline) return offline;
    throw new Error('Add Gemini API key in settings to parse complex entries.');
  }

  const { members } = getExpenseState();
  const memberNames = members.map((m) => m.name).join(', ') || '(none yet — infer name from speech)';
  const dayRef = days.map((d) => `Day ${d.day} ${d.date}`).join('; ');
  const prompt = `${MONEY_JSON_INSTRUCTION.replace('{{MEMBERS}}', memberNames).replace('{{DAYS}}', dayRef)}\n\nUser said: "${text}"`;

  try {
    const raw = await callGeminiExpenseJson(config, prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = parsed.action === 'give' ? 'give' : 'expense';

    if (action === 'give') {
      const from = resolveMember(String(parsed.fromPersonName || ''));
      const to = resolveMember(String(parsed.toPersonName || ''));
      if (!from || !to) throw new Error('Could not match traveller names for transfer.');
      const dateLabel = String(parsed.dateLabel || '25 Dec');
      return {
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
      };
    }

    const paidByName = String(parsed.paidByName || 'Unassigned');
    let member = resolveMember(paidByName);
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

    return {
      kind: 'expense',
      tripDate: String(parsed.tripDate || '2026-12-25'),
      dateLabel: String(parsed.dateLabel || '25 Dec'),
      description: String(parsed.description || 'Expense'),
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
      source: 'ai',
    };
  } catch {
    if (offline) return offline;
    throw new Error(
      'Could not understand. Try: "Rahul gave 10000 to Sanket cash" or "Sanket spent 800 dinner from balance cash".',
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
  return action;
}
