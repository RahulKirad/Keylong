import {
  PLACE_TEMP_PROFILES,
  TEMP_DATE_KEYS,
  type PlaceTempProfile,
  type TempDayKey,
  type TempReading,
} from './temperatureData';

const CACHE_KEY = 'spiti-tour-2026-temperature-cache-v1';

export type CachedPlaceDay = {
  highC: number;
  lowC: number;
};

export type TemperatureCache = {
  fetchedAt: string;
  source: 'open-meteo';
  byPlace: Record<string, Partial<Record<TempDayKey, CachedPlaceDay>>>;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function readCache(): TemperatureCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TemperatureCache;
    if (!parsed?.byPlace || !parsed.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: TemperatureCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  notify();
}

export function getTemperatureCache(): TemperatureCache | null {
  return readCache();
}

export function subscribeTemperature(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveReading(
  profile: PlaceTempProfile,
  dateKey: TempDayKey,
  cache: TemperatureCache | null = readCache(),
): { reading: TempReading; source: 'live-cache' | 'offline-typical' } {
  const live = cache?.byPlace?.[profile.placeId]?.[dateKey];
  if (live && Number.isFinite(live.highC) && Number.isFinite(live.lowC)) {
    return {
      reading: {
        highC: live.highC,
        lowC: live.lowC,
        note: profile.byDate[dateKey]?.note || '',
      },
      source: 'live-cache',
    };
  }
  return { reading: profile.byDate[dateKey], source: 'offline-typical' };
}

export function getResolvedProfiles(cache: TemperatureCache | null = readCache()) {
  return PLACE_TEMP_PROFILES.map((profile) => ({
    profile,
    days: TEMP_DATE_KEYS.map((dateKey) => {
      const { reading, source } = resolveReading(profile, dateKey, cache);
      return { dateKey, reading, source };
    }),
  }));
}

async function fetchPlaceDays(lat: number, lng: number): Promise<Partial<Record<TempDayKey, CachedPlaceDay>>> {
  const start = TEMP_DATE_KEYS[0];
  const end = TEMP_DATE_KEYS[TEMP_DATE_KEYS.length - 1];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FKolkata&start_date=${start}&end_date=${end}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: Array<number | null>;
      temperature_2m_min?: Array<number | null>;
    };
  };

  const times = data.daily?.time || [];
  const highs = data.daily?.temperature_2m_max || [];
  const lows = data.daily?.temperature_2m_min || [];
  const out: Partial<Record<TempDayKey, CachedPlaceDay>> = {};

  times.forEach((iso, i) => {
    if (!TEMP_DATE_KEYS.includes(iso as TempDayKey)) return;
    const highC = highs[i];
    const lowC = lows[i];
    if (typeof highC !== 'number' || typeof lowC !== 'number') return;
    out[iso as TempDayKey] = { highC, lowC };
  });

  return out;
}

/**
 * Refresh trip-window temperatures from Open-Meteo when online.
 * Results are stored in localStorage so the calendar still works offline later.
 * Dates outside the API forecast window simply keep the bundled typical values.
 */
export async function refreshTemperaturesOnline(): Promise<{
  ok: boolean;
  message: string;
  updatedPlaces: number;
}> {
  if (!navigator.onLine) {
    return {
      ok: false,
      message: 'No network — showing bundled winter temperatures (and any earlier cached live values).',
      updatedPlaces: 0,
    };
  }

  const byPlace: TemperatureCache['byPlace'] = { ...(readCache()?.byPlace || {}) };
  let updatedPlaces = 0;
  const errors: string[] = [];

  // Sequential to be gentle on the free API; trip has ~13 places.
  for (const profile of PLACE_TEMP_PROFILES) {
    try {
      const days = await fetchPlaceDays(profile.lat, profile.lng);
      if (Object.keys(days).length) {
        byPlace[profile.placeId] = { ...(byPlace[profile.placeId] || {}), ...days };
        updatedPlaces += 1;
      }
    } catch (err) {
      errors.push(profile.name);
    }
  }

  if (updatedPlaces === 0) {
    return {
      ok: false,
      message:
        errors.length > 0
          ? 'Could not refresh live temperatures. Offline typical values stay available.'
          : 'Live forecast does not cover 23 Dec–4 Jan yet. Offline typical winter values are shown; try again closer to the trip.',
      updatedPlaces: 0,
    };
  }

  writeCache({
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo',
    byPlace,
  });

  const partialNote =
    updatedPlaces < PLACE_TEMP_PROFILES.length
      ? ` (${updatedPlaces}/${PLACE_TEMP_PROFILES.length} places; others keep typical values)`
      : '';

  return {
    ok: true,
    message: `Live temperatures cached for offline use${partialNote}.`,
    updatedPlaces,
  };
}
