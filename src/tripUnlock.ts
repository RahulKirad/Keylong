export const APP_PASSWORD = '1010';

const UNLOCK_KEY = 'winter-himachal-unlocked';

export function isAppUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockApp(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    // Unlock still applies for this open page if storage is blocked.
  }
  window.dispatchEvent(new CustomEvent('app-unlocked'));
}

export function lockApp(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new CustomEvent('app-locked'));
}

export function checkPassword(value: string): boolean {
  return value.trim() === APP_PASSWORD;
}
