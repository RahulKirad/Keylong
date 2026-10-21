import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';
import { isOverloadError } from './geminiClient';
import { addMember, getExpenseState } from './expenseStore';
import {
  AssignmentInput,
  ensureAssigneeMember,
  resolveAssigneeFromText,
  resolveTripDayFromText,
} from './assignmentStore';
import { days } from './tripData';
import { seedDefaultTravellersIfNeeded } from './travellerSeed';

export type ParsedAssignment = AssignmentInput;

const ASSIGN_JSON = `You extract ONE trip task assignment from the user's message for Winter Himachal (23 Dec 2026 – 3 Jan 2027).
Travellers: {{MEMBERS}}
Trip days: {{DAYS}}

Reply with ONLY valid JSON:
{"assigneeName":"string","task":"what they should do","tripDayNumber":number or null,"dateLabel":"e.g. Wed · 23 Dec or null"}

Rules:
- "Rahul is assigned to book train tickets for 23rd" → assignee Rahul, task book train tickets, day 1 (23 Dec).
- Map 23rd/24 Dec/Day 3 to tripDayNumber 1–12 when possible.
- task is a short actionable phrase without the person's name.`;

function offlineParse(text: string): ParsedAssignment | null {
  seedDefaultTravellersIfNeeded();
  const assigneeName = resolveAssigneeFromText(text);
  if (!assigneeName) return null;

  let task = '';
  const patterns = [
    /\bis\s+assigned\s+to\s+(.+)/i,
    /\bassigned\s+to\s+(.+)/i,
    /\bshould\s+(.+)/i,
    /\bwill\s+(.+)/i,
    /\bto\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      task = m[1].trim();
      break;
    }
  }
  task = task
    .replace(/\bfor\s+the\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+dec|\s+jan)?\b/gi, '')
    .replace(/\bon\s+day\s*\d+\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:dec|january|jan|december)\b/gi, '')
    .trim();
  if (task.length > 160) task = task.slice(0, 160);
  if (!task) task = 'Trip task';

  let member = ensureAssigneeMember(assigneeName);
  if (!member) member = addMember(assigneeName) || undefined;
  if (!member) return null;

  const day = resolveTripDayFromText(text);

  return {
    assigneePersonId: member.id,
    assigneeName: member.name,
    task,
    tripDayNumber: day?.tripDayNumber,
    dateLabel: day?.dateLabel,
    source: 'offline',
  };
}

async function callGemini(config: GeminiConfig, prompt: string): Promise<string> {
  const apiKey = config.apiKey.trim();
  const models = [config.model || DEFAULT_GEMINI_MODEL, ...GEMINI_MODEL_IDS];
  for (const model of [...new Set(models)]) {
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
    const t = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '';
    if (t.trim()) return t.trim();
  }
  throw new Error('Could not parse assignment with AI.');
}

export async function parseAssignmentUtterance(
  text: string,
  config: GeminiConfig,
  online: boolean,
): Promise<ParsedAssignment> {
  const offline = offlineParse(text);
  if (!online && offline) return offline;
  if (!online) {
    throw new Error('Offline: try “Rahul is assigned to book train tickets for 23rd”.');
  }
  if (!config.apiKey.trim()) {
    if (offline) return offline;
    throw new Error('Add Gemini API key in settings for complex assignments.');
  }

  seedDefaultTravellersIfNeeded();
  const { members } = getExpenseState();
  const memberNames = members.map((m) => m.name).join(', ');
  const dayRef = days.map((d) => `Day ${d.day}: ${d.date} — ${d.title}`).join('; ');
  const prompt = `${ASSIGN_JSON.replace('{{MEMBERS}}', memberNames).replace('{{DAYS}}', dayRef)}\n\nUser: "${text}"`;

  try {
    const raw = await callGemini(config, prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]) as {
      assigneeName: string;
      task: string;
      tripDayNumber?: number | null;
      dateLabel?: string | null;
    };
    let member = ensureAssigneeMember(parsed.assigneeName);
    if (!member) member = addMember(parsed.assigneeName) || undefined;
    if (!member) throw new Error('Could not match traveller name.');

    let tripDayNumber = parsed.tripDayNumber ?? undefined;
    let dateLabel = parsed.dateLabel ?? undefined;
    if (!tripDayNumber) {
      const day = resolveTripDayFromText(text);
      if (day) {
        tripDayNumber = day.tripDayNumber;
        dateLabel = day.dateLabel;
      }
    } else {
      const d = days.find((x) => x.day === tripDayNumber);
      if (d) dateLabel = d.date;
    }

    return {
      assigneePersonId: member.id,
      assigneeName: member.name,
      task: parsed.task || 'Trip task',
      tripDayNumber,
      dateLabel: dateLabel || undefined,
      source: 'ai',
    };
  } catch {
    if (offline) return offline;
    throw new Error('Try: “Rahul is assigned to book the train tickets for 23rd”.');
  }
}
