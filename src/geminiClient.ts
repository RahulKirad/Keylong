import { ASSISTANT_SYSTEM_PROMPT, buildTripKnowledgeDocument } from './tripKnowledge';
import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_IDS } from './geminiConfig';

export type ChatTurn = { role: 'user' | 'model'; text: string };

const knowledge = buildTripKnowledgeDocument();

const CHAT_MODEL_BLOCK =
  /embed|tts|live|image|imagen|aqa|computer|nano-banana|vision-only|preview-tts/i;

function isChatModelId(id: string): boolean {
  if (CHAT_MODEL_BLOCK.test(id)) return false;
  return /gemini|argon/i.test(id);
}

export function isOverloadError(message: string, status?: number): boolean {
  const m = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    m.includes('high demand') ||
    m.includes('resource exhausted') ||
    m.includes('overloaded') ||
    m.includes('try again later')
  );
}

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) return [];
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': apiKey.trim() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Could not list models (${res.status})`);
  }
  const models = (data.models || []) as {
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }[];
  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name || '').replace(/^models\//, ''))
    .filter((id) => id && isChatModelId(id))
    .sort((a, b) => a.localeCompare(b));
}

async function generateWithModel(
  apiKey: string,
  model: string,
  history: ChatTurn[],
  userMessage: string,
): Promise<string> {
  const contents = [
    ...history.map((t) => ({
      role: t.role === 'user' ? 'user' : 'model',
      parts: [{ text: t.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: ASSISTANT_SYSTEM_PROMPT + knowledge }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API error (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
  const text = parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text.trim()) throw new Error('Empty response from Gemini.');
  return text.trim();
}

export async function sendToGemini(
  config: GeminiConfig,
  history: ChatTurn[],
  userMessage: string,
  fallbackModelIds: string[] = GEMINI_MODEL_IDS,
): Promise<{ text: string; modelUsed: string }> {
  // First attempt server-side proxy
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-key': config.apiKey?.trim() || '',
      },
      body: JSON.stringify({
        history,
        userMessage,
        model: config.model?.trim() || DEFAULT_GEMINI_MODEL,
        systemInstruction: ASSISTANT_SYSTEM_PROMPT + knowledge,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.text) {
        return { text: data.text, modelUsed: data.modelUsed || config.model || DEFAULT_GEMINI_MODEL };
      }
    }
  } catch {
    // Server proxy unavailable, proceed to client fallback
  }

  if (!config.apiKey.trim()) {
    throw new Error('Add your Gemini API key in AI settings (gear icon) or set GEMINI_API_KEY on server.');
  }

  const apiKey = config.apiKey.trim();
  const primary = config.model?.trim() || DEFAULT_GEMINI_MODEL;
  const tryOrder = [primary, ...fallbackModelIds.filter((id) => id !== primary)];

  let lastError: Error & { status?: number } | null = null;

  for (const model of tryOrder) {
    try {
      const text = await generateWithModel(apiKey, model, history, userMessage);
      return { text, modelUsed: model };
    } catch (e) {
      const err = e as Error & { status?: number };
      lastError = err;
      if (isOverloadError(err.message, err.status) && model !== tryOrder[tryOrder.length - 1]) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All models failed. Try another model in settings.');
}

export const PDF_TAG_RE = /\[PDF:(itinerary|transport|safety|places|full)\]/gi;

export type PdfKind = 'itinerary' | 'transport' | 'safety' | 'places' | 'full';

export function parseAssistantReply(raw: string): { displayText: string; pdfKind: PdfKind | null } {
  let pdfKind: PdfKind | null = null;
  const match = raw.match(PDF_TAG_RE);
  if (match) {
    const kind = match[0].replace(/\[PDF:|]/gi, '').toLowerCase() as PdfKind;
    pdfKind = kind;
  }
  const displayText = raw.replace(PDF_TAG_RE, '').trim();
  return { displayText, pdfKind };
}
