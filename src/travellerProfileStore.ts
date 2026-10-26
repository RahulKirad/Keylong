import { stableMemberId } from './memberIdentity';

export type TravellerProfile = {
  personId: string;
  personName: string;
  photoDataUrl?: string;
  updatedAt: number;
};

const STORAGE_KEY = 'winter-himachal-traveller-profiles-v1';

function readAll(): TravellerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TravellerProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: TravellerProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new CustomEvent('traveller-profiles-updated'));
  window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
}

export function listTravellerProfiles(): TravellerProfile[] {
  return readAll();
}

export function getTravellerProfile(nameOrId: string): TravellerProfile | undefined {
  const key = nameOrId.trim().toLowerCase();
  if (!key) return undefined;
  return readAll().find(
    (p) =>
      p.personId.toLowerCase() === key ||
      p.personName.trim().toLowerCase() === key ||
      stableMemberId(p.personName) === nameOrId,
  );
}

export function getTravellerPhoto(nameOrId: string): string | undefined {
  return getTravellerProfile(nameOrId)?.photoDataUrl;
}

export function saveTravellerProfile(input: {
  personId?: string;
  personName: string;
  photoDataUrl?: string;
}): TravellerProfile {
  const personName = input.personName.trim();
  if (!personName) throw new Error('Choose a traveller first.');
  const personId = (input.personId || stableMemberId(personName)).trim();
  const next: TravellerProfile = {
    personId,
    personName,
    photoDataUrl: input.photoDataUrl,
    updatedAt: Date.now(),
  };
  const rest = readAll().filter(
    (p) =>
      p.personId !== personId &&
      p.personName.trim().toLowerCase() !== personName.toLowerCase(),
  );
  rest.push(next);
  try {
    writeAll(rest);
  } catch {
    throw new Error('Could not save that photo on this device. Try a smaller image.');
  }
  return next;
}

export function clearTravellerPhoto(nameOrId: string): void {
  const existing = getTravellerProfile(nameOrId);
  if (!existing) return;
  saveTravellerProfile({
    personId: existing.personId,
    personName: existing.personName,
    photoDataUrl: undefined,
  });
}

export function setTravellerProfilesFromServer(rows: TravellerProfile[]): void {
  const byId = new Map<string, TravellerProfile>();
  for (const row of rows) {
    if (!row.personId || !row.personName) continue;
    const prev = byId.get(row.personId);
    if (!prev || (row.updatedAt || 0) >= (prev.updatedAt || 0)) {
      byId.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        photoDataUrl: row.photoDataUrl || undefined,
        updatedAt: row.updatedAt || Date.now(),
      });
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...byId.values()]));
  window.dispatchEvent(new CustomEvent('traveller-profiles-updated'));
}

export function subscribeTravellerProfiles(listener: () => void): () => void {
  window.addEventListener('traveller-profiles-updated', listener);
  return () => window.removeEventListener('traveller-profiles-updated', listener);
}

/** Compress a profile photo for storage / sync (small square-ish JPEG). */
export function readProfilePhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Choose a photo (JPG or PNG).'));
  }
  if (file.size > 8_000_000) {
    return Promise.reject(new Error('That photo is too large. Pick a smaller one.'));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxEdge = 480;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const w = Math.max(1, Math.round(image.width * scale));
      const h = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare that photo.'));
        return;
      }
      ctx.drawImage(image, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    image.src = url;
  });
}
