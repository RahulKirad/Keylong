export type AssistantMode = 'trip' | 'expense';

type OpenFn = (mode: AssistantMode) => void;

let openFn: OpenFn | null = null;

export function registerAssistantOpener(fn: OpenFn): void {
  openFn = fn;
}

export function openTripAssistant(mode: AssistantMode = 'trip'): void {
  openFn?.(mode);
}
