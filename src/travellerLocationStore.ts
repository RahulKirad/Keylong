import { stableMemberId } from './memberIdentity';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import { supabase, supabaseConfigured } from './supabaseClient';

export type TravellerLocation = {
  personId: string;
  personName: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  updatedAt: number;
  sharing: boolean;
};

const SHARE_PREF_KEY = 'winter-himachal-gps-share-v1';
const LOCAL_CACHE_KEY = 'winter-himachal-gps-locations-v1';

/** Battery-friendly: low accuracy, reuse cached fixes, long gap between polls. */
export const GPS_POLL_MS = 75_000;
export const GPS_MIN_MOVE_M = 35;
export const GPS_STALE_MS = 12 * 60_000;
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 90_000,
  timeout: 20_000,
};

function loadCache(): TravellerLocation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TravellerLocation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSharePref(): boolean {
  try {
    return localStorage.getItem(SHARE_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSharePref(on: boolean): void {
  try {
    localStorage.setItem(SHARE_PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let sharingEnabled = readSharePref();
let locations: TravellerLocation[] = loadCache();
let pollTimer: number | null = null;
let lastPublished: { lat: number; lng: number; at: number } | null = null;
let tracking = false;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(locations));
  } catch {
    /* ignore */
  }
}

export function subscribeTravellerLocations(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getTravellerLocations(): TravellerLocation[] {
  return locations;
}

export function isGpsSharingEnabled(): boolean {
  return sharingEnabled;
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function upsertLocal(row: TravellerLocation): void {
  const next = locations.filter(
    (l) => l.personId !== row.personId && l.personName.toLowerCase() !== row.personName.toLowerCase(),
  );
  locations = [...next, row].sort((a, b) => a.personName.localeCompare(b.personName));
  notify();
}

async function publishLocation(row: TravellerLocation): Promise<void> {
  upsertLocal(row);
  if (!supabaseConfigured) return;
  try {
    await supabase.from('trip_traveller_locations').upsert(
      {
        person_id: row.personId,
        person_name: row.personName,
        lat: row.lat,
        lng: row.lng,
        accuracy_m: row.accuracyM ?? null,
        updated_at: row.updatedAt,
        sharing: row.sharing,
      },
      { onConflict: 'person_id' },
    );
  } catch (e) {
    console.warn('GPS cloud publish failed:', e);
  }
}

async function markStoppedSharing(personId: string, personName: string): Promise<void> {
  const existing = locations.find((l) => l.personId === personId);
  if (existing) {
    upsertLocal({ ...existing, sharing: false, updatedAt: Date.now() });
  }
  if (!supabaseConfigured) return;
  try {
    await supabase.from('trip_traveller_locations').upsert(
      {
        person_id: personId,
        person_name: personName,
        lat: existing?.lat ?? 0,
        lng: existing?.lng ?? 0,
        accuracy_m: existing?.accuracyM ?? null,
        updated_at: Date.now(),
        sharing: false,
      },
      { onConflict: 'person_id' },
    );
  } catch (e) {
    console.warn('GPS stop-share failed:', e);
  }
}

export async function fetchTravellerLocationsFromCloud(): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from('trip_traveller_locations')
      .select('*')
      .eq('sharing', true);
    if (error) throw error;
    const remote: TravellerLocation[] = (data || []).map((r: any) => ({
      personId: r.person_id,
      personName: r.person_name,
      lat: Number(r.lat),
      lng: Number(r.lng),
      accuracyM: r.accuracy_m != null ? Number(r.accuracy_m) : undefined,
      updatedAt: Number(r.updated_at) || Date.now(),
      sharing: r.sharing !== false,
    }));
    const me = getSelectedTraveller()?.toLowerCase();
    const localMine = locations.filter(
      (l) => me && l.personName.toLowerCase() === me && l.sharing,
    );
    const merged = new Map<string, TravellerLocation>();
    for (const row of remote) merged.set(row.personId, row);
    for (const row of localMine) {
      const cur = merged.get(row.personId);
      if (!cur || row.updatedAt >= cur.updatedAt) merged.set(row.personId, row);
    }
    locations = [...merged.values()].sort((a, b) => a.personName.localeCompare(b.personName));
    notify();
  } catch (e) {
    console.warn('GPS cloud fetch failed:', e);
  }
}

function readPositionOnce(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

async function tick(): Promise<void> {
  if (!sharingEnabled || document.hidden) return;
  const name = getSelectedTraveller();
  if (!name) return;

  try {
    const pos = await readPositionOnce();
    const { latitude, longitude, accuracy } = pos.coords;
    const now = Date.now();
    if (
      lastPublished &&
      now - lastPublished.at < GPS_POLL_MS / 2 &&
      haversineMeters(lastPublished.lat, lastPublished.lng, latitude, longitude) < GPS_MIN_MOVE_M
    ) {
      return;
    }
    lastPublished = { lat: latitude, lng: longitude, at: now };
    await publishLocation({
      personId: stableMemberId(name),
      personName: name,
      lat: latitude,
      lng: longitude,
      accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined,
      updatedAt: now,
      sharing: true,
    });
  } catch (e) {
    console.warn('GPS fix failed:', e);
  }
}

function clearPoll(): void {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  clearPoll();
  void tick();
  pollTimer = window.setInterval(() => {
    void tick();
  }, GPS_POLL_MS);
}

export async function setGpsSharingEnabled(on: boolean): Promise<void> {
  sharingEnabled = on;
  writeSharePref(on);
  notify();
  const name = getSelectedTraveller();
  if (!on) {
    clearPoll();
    tracking = false;
    if (name) await markStoppedSharing(stableMemberId(name), name);
    return;
  }
  if (!name) throw new Error('Select your traveller name first (unlock / login).');
  if (!navigator.geolocation) throw new Error('GPS is not available in this browser.');
  tracking = true;
  startPolling();
}

export function startGpsTrackerIfNeeded(): void {
  if (!sharingEnabled || tracking) return;
  if (!getSelectedTraveller()) return;
  tracking = true;
  startPolling();
}

export function stopGpsTracker(): void {
  clearPoll();
  tracking = false;
}

/** Stable color for a traveller name (map dots). */
export function colourForTraveller(name: string): string {
  const palette = [
    '#17384b',
    '#1a5c45',
    '#8a5a3c',
    '#1a5267',
    '#6b3d5a',
    '#3d5a6b',
    '#5a6b3d',
    '#6b4a1a',
    '#4a3d6b',
    '#1a6b5a',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function isLocationFresh(loc: TravellerLocation, now = Date.now()): boolean {
  return loc.sharing && now - loc.updatedAt < GPS_STALE_MS;
}

subscribeSelectedTraveller(() => {
  if (!sharingEnabled) return;
  clearPoll();
  tracking = false;
  startGpsTrackerIfNeeded();
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (sharingEnabled) void tick();
  });
}
