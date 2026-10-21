export const GEMINI_STORAGE_KEY = 'winter-himachal-gemini-config';

export type GeminiConfig = {
  apiKey: string;
  model: string;
  voiceEnabled: boolean;
  voiceLang: string;
};

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  apiKey: '',
  model: 'gemini-2.0-flash',
  voiceEnabled: true,
  voiceLang: 'en-IN',
};

export const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (recommended)' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

export function loadGeminiConfig(): GeminiConfig {
  try {
    const raw = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GEMINI_CONFIG };
    return { ...DEFAULT_GEMINI_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GEMINI_CONFIG };
  }
}

export function saveGeminiConfig(config: GeminiConfig): void {
  localStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify(config));
}
