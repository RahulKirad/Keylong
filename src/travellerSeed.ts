import { DEFAULT_TRAVELLER_NAMES } from './defaultTravellers';

type Member = { id: string; name: string };

let seedFn: (() => void) | null = null;

/** Registered by expenseStore to avoid circular imports at module init. */
export function registerTravellerSeeder(fn: () => void): void {
  seedFn = fn;
}

export function seedDefaultTravellersIfNeeded(): void {
  seedFn?.();
}

export { DEFAULT_TRAVELLER_NAMES };

export function isDefaultTravellerName(name: string): boolean {
  return DEFAULT_TRAVELLER_NAMES.some((n) => n.toLowerCase() === name.trim().toLowerCase());
}
