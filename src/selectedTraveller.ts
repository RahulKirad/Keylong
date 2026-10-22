const STORAGE_KEY = 'winter-himachal-active-traveller';

function readStored(): string | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved?.trim() || null;
  } catch {
    return null;
  }
}

let selectedName: string | null = readStored();
const listeners = new Set<(name: string | null) => void>();

export function getSelectedTraveller(): string | null {
  return selectedName;
}

export function setSelectedTraveller(name: string): void {
  const next = name.trim();
  if (!next || next === selectedName) return;
  selectedName = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still applies for this open page if storage is blocked.
  }
  listeners.forEach((listener) => listener(selectedName));
  window.dispatchEvent(new CustomEvent('traveller-selected', { detail: selectedName }));
}

export function subscribeSelectedTraveller(listener: (name: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
