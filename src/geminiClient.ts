import { ASSISTANT_SYSTEM_PROMPT, buildTripKnowledgeDocument } from './tripKnowledge';
import type { GeminiConfig } from './geminiConfig';
import { DEFAULT_GEMINI_MODEL } from './geminiConfig';

export type ChatTurn = { role: 'user' | 'model'; text: string };

const knowledge = buildTripKnowledgeDocument();

export async function sendToGemini(
  config: GeminiConfig,
  history: ChatTurn[],
  userMessage: string,
): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('Add your Gemini API key in AI settings (gear icon).');
  }

  const model = config.model?.trim() || DEFAULT_GEMINI_MODEL;

  const contents = [
    ...history.map((t) => ({
      role: t.role === 'user' ? 'user' : 'model',
      parts: [{ text: t.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const apiKey = config.apiKey.trim();

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
    throw new Error(msg);
  }

  const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
  const text = parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text.trim()) throw new Error('Empty response from Gemini.');
  return text.trim();
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
