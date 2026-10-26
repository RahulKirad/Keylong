import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';
import { isOverloadError } from './geminiClient';
import { buildTripSpendingContext, tryEvalMathExpression } from './smartCalculatorContext';

export type SmartCalcResult = {
  answer: string;
  numericResult?: number;
  suggestions?: string[];
  source: 'local' | 'ai' | 'hybrid';
  modelUsed?: string;
};

const SYSTEM = `You are the Spiti Tour 2026 Smart Calculator.
You help travellers do arithmetic and trip-money math using the LIVE spending ledger provided.
Rules:
- Prefer exact INR figures from the ledger when the question is about logged expenses, splits, who owes whom, budget left, per-person shares.
- For pure arithmetic (e.g. 17500/7), compute precisely.
- Keep answers short and practical. Use Indian Rupee formatting like ₹1,750.
- End with 2–3 short follow-up suggestion lines prefixed with "Try: " that relate to THIS trip's spending (not generic).
- If data is missing, say what is missing and still give a useful formula.
- Do not invent expenses that are not in the ledger.`;

async function callGeminiCalc(config: GeminiConfig, userPrompt: string, context: string): Promise<{ text: string; model: string }> {
  const apiKey = config.apiKey.trim();
  const models = [config.model || DEFAULT_GEMINI_MODEL, ...GEMINI_MODEL_IDS];
  const unique = [...new Set(models)];
  const full = `${SYSTEM}\n\nLEDGER:\n${context}\n\nUSER QUESTION:\n${userPrompt}`;

  for (const model of unique) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: full }] }],
        generationConfig: { maxOutputTokens: 768 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || '';
      if (isOverloadError(msg, res.status)) continue;
      throw new Error(msg || `Gemini error ${res.status}`);
    }
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '';
    if (text.trim()) return { text: text.trim(), model };
  }
  throw new Error('Smart calculator AI is busy. Try again or use the keypad.');
}

function extractSuggestions(text: string): { body: string; suggestions: string[] } {
  const lines = text.split('\n');
  const suggestions: string[] = [];
  const bodyLines: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:Try:|Suggestion:|•\s*Try:)\s*(.+)$/i);
    if (m) suggestions.push(m[1].trim());
    else bodyLines.push(line);
  }
  return { body: bodyLines.join('\n').trim(), suggestions: suggestions.slice(0, 4) };
}

export async function runSmartCalculation(
  query: string,
  config: GeminiConfig,
  online: boolean,
): Promise<SmartCalcResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Enter a number or a trip question.');

  const local = tryEvalMathExpression(trimmed);
  const looksLikePureMath = /^[\d\s+\-*/().%,×÷−₹rs.inrupee]+$/i.test(trimmed);

  if (local != null && looksLikePureMath) {
    return {
      answer: `Result: ₹${local.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      numericResult: local,
      source: 'local',
      suggestions: [
        'Divide this by number of travellers',
        'Add this to group total spent',
        'What is each person’s share of group total?',
      ],
    };
  }

  if (!online) {
    if (local != null) {
      return {
        answer: `Offline result: ₹${local.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        numericResult: local,
        source: 'local',
      };
    }
    throw new Error('Offline — use the keypad for math, or go online for trip-aware AI answers.');
  }

  if (!config.apiKey.trim()) {
    if (local != null) {
      return {
        answer: `Result: ₹${local.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (add Gemini API key for trip-aware suggestions)`,
        numericResult: local,
        source: 'local',
      };
    }
    throw new Error('Add a Gemini API key in the AI assistant settings to use trip-smart calculations.');
  }

  const context = buildTripSpendingContext();
  const { text, model } = await callGeminiCalc(config, trimmed, context);
  const { body, suggestions } = extractSuggestions(text);
  const maybeNum = tryEvalMathExpression(trimmed);

  return {
    answer: body || text,
    numericResult: maybeNum ?? undefined,
    suggestions: suggestions.length
      ? suggestions
      : [
          'Who owes whom after splits?',
          'Per-person share of group total',
          'Food vs transport so far',
        ],
    source: local != null ? 'hybrid' : 'ai',
    modelUsed: model,
  };
}
