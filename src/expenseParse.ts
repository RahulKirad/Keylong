import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';
import { isOverloadError } from './geminiClient';
import {
  ExpenseInput,
  addMember,
  findMemberByName,
  getExpenseState,
  parseDateFromText,
} from './expenseStore';
import { days } from './tripData';

export type ParsedExpense = ExpenseInput;

const EXPENSE_JSON_INSTRUCTION = `You extract ONE trip expense from the user's message for a Winter Himachal group trip (23 Dec 2026 – 3 Jan 2027).
Known travellers (use exact name if match): {{MEMBERS}}
Trip days reference: {{DAYS}}

Reply with ONLY valid JSON (no markdown):
{"description":"string","category":"Food|Stay|Transport|Activity|Shopping|Other","amountInr":number,"dateLabel":"e.g. 25 Dec","tripDate":"YYYY-MM-DD","paidByName":"string"}

Rules:
- amountInr is integer INR only.
- If payer not stated, use paidByName "Shared" only if user said shared/split; otherwise best guess from context or first member.
- Map "25th dinner 2000 rahul" → date 25 Dec 2026, dinner, Food, 2000, Rahul.
- If date missing use today in trip context or 25 Dec 2026.`;

function offlineParse(text: string): ParsedExpense | null {
  const amountMatch = text.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d[\d,]*)/i) || text.match(/(\d[\d,]*)\s*(?:₹|rs\.?|inr|rupees?)/i);
  const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const date = parseDateFromText(text) || { tripDate: '2026-12-25', dateLabel: '25 Dec' };

  let paidByName = 'Unassigned';
  const { members } = getExpenseState();
  for (const m of members) {
    if (text.toLowerCase().includes(m.name.toLowerCase())) {
      paidByName = m.name;
      break;
    }
  }
  const paidByMatch = text.match(/\b(?:by|paid by|spent by)\s+([A-Za-z]+)/i);
  if (paidByMatch) paidByName = paidByMatch[1];

  const lower = text.toLowerCase();
  let category = 'Other';
  if (/dinner|lunch|breakfast|food|cafe|meal|tea/.test(lower)) category = 'Food';
  else if (/hotel|stay|room|guest/.test(lower)) category = 'Stay';
  else if (/taxi|cab|fuel|toll|transfer|train|flight/.test(lower)) category = 'Transport';
  else if (/shop|souvenir/.test(lower)) category = 'Shopping';

  let description = text
    .replace(/(\d[\d,]*)\s*(?:₹|rs\.?|inr|rupees?)/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:dec|jan)\b/gi, '')
    .trim();
  if (description.length > 80) description = description.slice(0, 80);
  if (!description) description = category === 'Food' ? 'Meal' : 'Expense';

  let member = findMemberByName(paidByName);
  if (!member && paidByName !== 'Unassigned' && paidByName !== 'Shared') {
    member = addMember(paidByName) || undefined;
  }
  if (!member && members[0]) {
    member = members[0];
    paidByName = member.name;
  }
  if (!member) {
    member = addMember(paidByName === 'Unassigned' ? 'Traveller 1' : paidByName) || undefined;
    if (member) paidByName = member.name;
  }

  return {
    tripDate: date.tripDate,
    dateLabel: date.dateLabel,
    description,
    category,
    amountInr: amount,
    paidByPersonId: member?.id || 'unknown',
    paidByName: member?.name || paidByName,
    source: 'offline',
  };
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
  throw new Error('Could not parse expense with AI.');
}

export async function parseExpenseUtterance(
  text: string,
  config: GeminiConfig,
  online: boolean,
): Promise<ParsedExpense> {
  const offline = offlineParse(text);
  if (!online && offline) return offline;
  if (!online) {
    throw new Error('Offline: could not parse amount. Say e.g. "25 Dec dinner 2000 Rahul".');
  }
  if (!config.apiKey.trim()) {
    if (offline) return offline;
    throw new Error('Add Gemini API key in settings to parse complex expenses.');
  }

  const { members } = getExpenseState();
  const memberNames = members.map((m) => m.name).join(', ') || '(none yet — infer name from speech)';
  const dayRef = days.map((d) => `Day ${d.day} ${d.date}`).join('; ');
  const prompt = `${EXPENSE_JSON_INSTRUCTION.replace('{{MEMBERS}}', memberNames).replace('{{DAYS}}', dayRef)}\n\nUser said: "${text}"`;

  try {
    const raw = await callGeminiExpenseJson(config, prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]) as {
      description: string;
      category: string;
      amountInr: number;
      dateLabel: string;
      tripDate: string;
      paidByName: string;
    };
    let member = findMemberByName(parsed.paidByName);
    if (!member) member = addMember(parsed.paidByName) || undefined;
    if (!member) throw new Error('Add trip members on the Expenses page first.');

    return {
      tripDate: parsed.tripDate,
      dateLabel: parsed.dateLabel,
      description: parsed.description || 'Expense',
      category: parsed.category || 'Other',
      amountInr: Math.round(parsed.amountInr),
      paidByPersonId: member.id,
      paidByName: member.name,
      source: 'ai',
    };
  } catch {
    if (offline) return offline;
    throw new Error('Could not understand expense. Try: "25 December dinner 2000 paid by Rahul".');
  }
}
