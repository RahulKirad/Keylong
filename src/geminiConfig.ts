import { supabase, supabaseConfigured } from './supabaseClient';

export const GEMINI_STORAGE_KEY = 'winter-himachal-gemini-config';

export type GeminiConfig = {
  apiKey: string;
  model: string;
  voiceEnabled: boolean;
  voiceLang: string;
};

export type GeminiModelOption = {
  id: string;
  label: string;
  hint?: string;
};

/** Default when busy — lighter models often have more capacity. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Curated text-chat models (generateContent). Shown in dropdown; API refresh may add more. */
export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    hint: 'Fast, high quota — good default when others are busy',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    hint: 'Very fast and cost-efficient',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    hint: 'Balanced speed and quality',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    hint: 'Most capable Flash — may show “high demand” at peak times',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    hint: 'Flagship reasoning — slower, higher quality',
  },
];

export const GEMINI_MODEL_IDS = GEMINI_MODEL_OPTIONS.map((m) => m.id);

const RETIRED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
]);

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  apiKey: '',
  model: DEFAULT_GEMINI_MODEL,
  voiceEnabled: true,
  voiceLang: 'en-IN',
};

export function labelForModelId(id: string): string {
  const known = GEMINI_MODEL_OPTIONS.find((m) => m.id === id);
  return known?.label ?? id;
}

export function mergeModelOptions(apiIds: string[]): GeminiModelOption[] {
  const map = new Map<string, GeminiModelOption>();
  for (const opt of GEMINI_MODEL_OPTIONS) map.set(opt.id, opt);
  for (const id of apiIds) {
    if (!map.has(id)) map.set(id, { id, label: id });
  }
  const ordered: GeminiModelOption[] = [];
  for (const opt of GEMINI_MODEL_OPTIONS) {
    if (map.has(opt.id)) ordered.push(map.get(opt.id)!);
  }
  for (const [id, opt] of map) {
    if (!GEMINI_MODEL_OPTIONS.some((m) => m.id === id)) ordered.push(opt);
  }
  return ordered;
}

export function loadGeminiConfig(): GeminiConfig {
  try {
    const raw = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GEMINI_CONFIG };
    const parsed = { ...DEFAULT_GEMINI_CONFIG, ...JSON.parse(raw) } as GeminiConfig;
    if (RETIRED_MODELS.has(parsed.model) || !parsed.model) {
      parsed.model = DEFAULT_GEMINI_MODEL;
      saveGeminiConfig(parsed);
    }
    return parsed;
  } catch {
    return { ...DEFAULT_GEMINI_CONFIG };
  }
}

export function saveGeminiConfig(config: GeminiConfig): void {
  localStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify(config));
}

export type SharedGeminiConfig = {
  apiKey: string;
  model: string;
};

const SHARED_BUDGET_ID = 'gemini-config';

/** The published site is a static page, so it must not call the local Express routes. */
export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function normalizeShared(apiKey: unknown, model: unknown): SharedGeminiConfig | null {
  if (typeof apiKey !== 'string' || !apiKey.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    model: typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_GEMINI_MODEL,
  };
}

async function readSharedFromDatabase(): Promise<SharedGeminiConfig | null> {
  if (!supabaseConfigured) return null;
  const budget = await supabase.from('trip_budget').select('categories').eq('id', SHARED_BUDGET_ID).maybeSingle();
  if (budget.error || !budget.data) return null;
  const stored = budget.data.categories as { apiKey?: unknown; model?: unknown } | null;
  if (!stored || Array.isArray(stored)) return null;
  return normalizeShared(stored.apiKey, stored.model);
}

/** The one Gemini key saved for this site, shared by every browser. */
export async function fetchSharedGeminiConfig(): Promise<SharedGeminiConfig | null> {
  try {
    const shared = await readSharedFromDatabase();
    if (shared?.apiKey) return shared;
  } catch {
    // Fall through to the local dev server when this browser cannot reach Supabase.
  }

  if (!isLocalDevHost()) return null;
  try {
    const res = await fetch('/api/gemini/config');
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return normalizeShared(data?.apiKey, data?.model);
  } catch {
    return null;
  }
}

/** Save the Gemini key in the shared trip database so every browser uses it. */
export async function publishSharedGeminiConfig(config: SharedGeminiConfig): Promise<void> {
  const apiKey = config.apiKey.trim();
  const model = config.model.trim() || DEFAULT_GEMINI_MODEL;
  let saved = false;

  if (supabaseConfigured) {
    const budget = await supabase.from('trip_budget').upsert(
      {
        id: SHARED_BUDGET_ID,
        categories: { apiKey, model },
        travelers: 0,
        trip_target: 0,
        updated_at: Date.now(),
      },
      { onConflict: 'id' },
    );
    if (!budget.error) saved = true;
  }

  if (isLocalDevHost()) {
    try {
      const res = await fetch('/api/gemini/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model }),
      });
      if (res.ok) saved = true;
    } catch {
      // The local Express route is optional. The shared database is the copy every browser reads.
    }
  }

  if (!saved) {
    throw new Error('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env so every browser can share this key.');
  }
}
