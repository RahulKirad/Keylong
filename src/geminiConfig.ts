export const GEMINI_STORAGE_KEY = 'winter-himachal-gemini-config';

export type GeminiConfig = {
  apiKey: string;
  model: string;
  voiceEnabled: boolean;
  voiceLang: string;
};

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** Older model IDs saved in localStorage are upgraded automatically. */
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

export const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (recommended)' },
];

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
