/** Offline winter temperature calendar for Spiti Tour 2026 (23 Dec – 4 Jan). */

export type TempDayKey =
  | '2026-12-23'
  | '2026-12-24'
  | '2026-12-25'
  | '2026-12-26'
  | '2026-12-27'
  | '2026-12-28'
  | '2026-12-29'
  | '2026-12-30'
  | '2026-12-31'
  | '2027-01-01'
  | '2027-01-02'
  | '2027-01-03'
  | '2027-01-04';

export type TempReading = {
  highC: number;
  lowC: number;
  /** Short packing / road note */
  note: string;
};

export type PlaceTempProfile = {
  placeId: string;
  name: string;
  region: string;
  alt: string;
  lat: number;
  lng: number;
  /** Typical late-Dec / early-Jan day readings (offline seed). */
  byDate: Record<TempDayKey, TempReading>;
};

export type TripDayTempFocus = {
  dateKey: TempDayKey;
  label: string;
  placeId: string;
  placeName: string;
  role: string;
};

export const TEMP_DATE_KEYS: TempDayKey[] = [
  '2026-12-23',
  '2026-12-24',
  '2026-12-25',
  '2026-12-26',
  '2026-12-27',
  '2026-12-28',
  '2026-12-29',
  '2026-12-30',
  '2026-12-31',
  '2027-01-01',
  '2027-01-02',
  '2027-01-03',
  '2027-01-04',
];

export const TEMP_DATE_LABEL: Record<TempDayKey, string> = {
  '2026-12-23': '23 Dec',
  '2026-12-24': '24 Dec',
  '2026-12-25': '25 Dec',
  '2026-12-26': '26 Dec',
  '2026-12-27': '27 Dec',
  '2026-12-28': '28 Dec',
  '2026-12-29': '29 Dec',
  '2026-12-30': '30 Dec',
  '2026-12-31': '31 Dec',
  '2027-01-01': '1 Jan',
  '2027-01-02': '2 Jan',
  '2027-01-03': '3 Jan',
  '2027-01-04': '4 Jan',
};

/** Primary place you are based / overnighting that calendar day. */
export const TRIP_TEMP_FOCUS: TripDayTempFocus[] = [
  { dateKey: '2026-12-23', label: 'Wed · 23 Dec', placeId: 'mumbai', placeName: 'Mumbai / train', role: 'Transit day' },
  { dateKey: '2026-12-24', label: 'Thu · 24 Dec', placeId: 'delhi', placeName: 'Delhi', role: 'Rest + overnight bus' },
  { dateKey: '2026-12-25', label: 'Fri · 25 Dec', placeId: 'shimla', placeName: 'Shimla', role: 'Overnight base' },
  { dateKey: '2026-12-26', label: 'Sat · 26 Dec', placeId: 'sangla', placeName: 'Sangla', role: 'Overnight base' },
  { dateKey: '2026-12-27', label: 'Sun · 27 Dec', placeId: 'kalpa', placeName: 'Kalpa', role: 'Overnight base' },
  { dateKey: '2026-12-28', label: 'Mon · 28 Dec', placeId: 'kaza', placeName: 'Kaza', role: 'Arrive Spiti' },
  { dateKey: '2026-12-29', label: 'Tue · 29 Dec', placeId: 'langza', placeName: 'Langza', role: 'Homestay overnight' },
  { dateKey: '2026-12-30', label: 'Wed · 30 Dec', placeId: 'kaza', placeName: 'Kaza', role: 'Spiti base' },
  { dateKey: '2026-12-31', label: 'Thu · 31 Dec', placeId: 'kaza', placeName: 'Kaza', role: 'New Year’s Eve' },
  { dateKey: '2027-01-01', label: 'Fri · 1 Jan', placeId: 'kalpa', placeName: 'Kalpa', role: 'Return corridor' },
  { dateKey: '2027-01-02', label: 'Sat · 2 Jan', placeId: 'kufri', placeName: 'Kufri', role: 'Pre-airport overnight' },
  { dateKey: '2027-01-03', label: 'Sun · 3 Jan', placeId: 'delhi', placeName: 'Delhi airport', role: 'Flight day' },
  { dateKey: '2027-01-04', label: 'Mon · 4 Jan', placeId: 'pune', placeName: 'Pune', role: 'Home' },
];

function series(
  highs: number[],
  lows: number[],
  notes: string[],
): Record<TempDayKey, TempReading> {
  const out = {} as Record<TempDayKey, TempReading>;
  TEMP_DATE_KEYS.forEach((key, i) => {
    out[key] = { highC: highs[i], lowC: lows[i], note: notes[i] || notes[notes.length - 1] };
  });
  return out;
}

/**
 * Bundled typical late-December / early-January °C for each stop.
 * Values are winter climatology for packing and planning — not a live forecast.
 * Live refresh (when online) overlays Open-Meteo and is cached for offline reuse.
 */
export const PLACE_TEMP_PROFILES: PlaceTempProfile[] = [
  {
    placeId: 'pune',
    name: 'Pune',
    region: 'Start / Finish',
    alt: '560 m',
    lat: 18.5204,
    lng: 73.8567,
    byDate: series(
      [29, 29, 30, 30, 30, 29, 29, 29, 29, 28, 28, 29, 29],
      [13, 13, 14, 14, 13, 13, 12, 12, 12, 12, 12, 13, 13],
      ['Mild plains start', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Mild', 'Home mild'],
    ),
  },
  {
    placeId: 'mumbai',
    name: 'Mumbai',
    region: 'Transit',
    alt: '14 m',
    lat: 19.0544,
    lng: 72.8402,
    byDate: series(
      [31, 31, 31, 32, 32, 31, 31, 31, 31, 30, 30, 31, 31],
      [19, 19, 20, 20, 19, 19, 18, 18, 18, 18, 18, 19, 19],
      ['Humid, warm train board', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm', 'Warm'],
    ),
  },
  {
    placeId: 'delhi',
    name: 'Delhi',
    region: 'Transit',
    alt: '216 m',
    lat: 28.6139,
    lng: 77.209,
    byDate: series(
      [20, 19, 19, 18, 18, 17, 17, 17, 16, 16, 16, 17, 17],
      [8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 5, 5],
      ['Cool city rest', 'Overnight bus evening', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Airport buffer day', 'Cool'],
    ),
  },
  {
    placeId: 'shimla',
    name: 'Shimla',
    region: 'Approach',
    alt: '2,276 m',
    lat: 31.1048,
    lng: 77.1734,
    byDate: series(
      [10, 9, 9, 8, 8, 7, 7, 7, 6, 6, 7, 8, 8],
      [1, 0, 0, -1, -1, -2, -2, -2, -3, -3, -2, -1, -1],
      ['Mountain entry', 'Cool', 'First overnight', 'Cold walk', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Return corridor', 'Cool', 'Cool'],
    ),
  },
  {
    placeId: 'narkanda',
    name: 'Narkanda / Rampur',
    region: 'Approach',
    alt: '2,708 m',
    lat: 31.2708,
    lng: 77.4594,
    byDate: series(
      [6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 3, 4, 4],
      [-2, -3, -3, -4, -4, -5, -5, -5, -6, -6, -5, -4, -4],
      ['En-route cold', 'Cold', 'Cold', 'Drive day chill', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Return drive', 'Cold', 'Cold'],
    ),
  },
  {
    placeId: 'sangla',
    name: 'Sangla',
    region: 'Kinnaur',
    alt: '2,600 m',
    lat: 31.4255,
    lng: 78.2661,
    byDate: series(
      [4, 3, 3, 3, 2, 2, 1, 1, 1, 1, 2, 3, 3],
      [-6, -7, -7, -7, -8, -8, -9, -9, -9, -9, -8, -7, -7],
      ['Valley cold', 'Cold', 'Cold', 'Baspa overnight', 'Chitkul optional colder', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Cold'],
    ),
  },
  {
    placeId: 'chitkul',
    name: 'Chitkul',
    region: 'Kinnaur',
    alt: '3,450 m',
    lat: 31.3515,
    lng: 78.4365,
    byDate: series(
      [0, -1, -1, -1, -2, -2, -3, -3, -3, -3, -2, -1, -1],
      [-10, -11, -11, -12, -12, -13, -13, -13, -14, -14, -13, -12, -12],
      ['Optional only', 'Very cold', 'Very cold', 'Very cold', 'Day push if open', 'Very cold', 'Very cold', 'Very cold', 'Very cold', 'Very cold', 'Very cold', 'Very cold', 'Very cold'],
    ),
  },
  {
    placeId: 'kalpa',
    name: 'Kalpa',
    region: 'Kinnaur',
    alt: '2,960 m',
    lat: 31.536,
    lng: 78.252,
    byDate: series(
      [3, 2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 2, 2],
      [-7, -8, -8, -8, -9, -9, -10, -10, -10, -10, -9, -8, -8],
      ['Cold staging', 'Cold', 'Cold', 'Cold', 'Overnight base', 'Early Spiti push', 'Cold', 'Cold', 'Cold', 'Return overnight', 'Cold', 'Cold', 'Cold'],
    ),
  },
  {
    placeId: 'nako',
    name: 'Nako / Sumdo',
    region: 'Spiti approach',
    alt: '3,662 m',
    lat: 31.8806,
    lng: 78.6278,
    byDate: series(
      [-1, -2, -2, -2, -3, -3, -4, -4, -4, -4, -3, -2, -2],
      [-12, -13, -13, -14, -14, -15, -15, -15, -16, -16, -15, -14, -14],
      ['High corridor', 'Bitter', 'Bitter', 'Bitter', 'Bitter', 'Drive halt', 'Bitter', 'Bitter', 'Bitter', 'Return halt', 'Bitter', 'Bitter', 'Bitter'],
    ),
  },
  {
    placeId: 'tabo',
    name: 'Tabo',
    region: 'Spiti',
    alt: '3,280 m',
    lat: 32.0936,
    lng: 78.3831,
    byDate: series(
      [0, -1, -1, -1, -2, -2, -3, -3, -3, -3, -2, -1, -1],
      [-11, -12, -12, -12, -13, -13, -14, -14, -14, -14, -13, -12, -12],
      ['Spiti cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Status stop', 'Cold', 'Cold', 'Cold', 'Return stop', 'Cold', 'Cold', 'Cold'],
    ),
  },
  {
    placeId: 'kaza',
    name: 'Kaza',
    region: 'Spiti',
    alt: '3,650 m',
    lat: 32.2277,
    lng: 78.071,
    byDate: series(
      [-2, -3, -3, -3, -4, -4, -5, -5, -5, -5, -4, -3, -3],
      [-14, -15, -15, -15, -16, -16, -17, -17, -17, -17, -16, -15, -15],
      ['Deep Spiti cold', 'Cold', 'Cold', 'Cold', 'Cold', 'Arrive Kaza', 'Base day', 'Market / rest', 'NYE — dress in layers', 'Leave early', 'Cold', 'Cold', 'Cold'],
    ),
  },
  {
    placeId: 'langza',
    name: 'Langza',
    region: 'Spiti',
    alt: '4,400 m',
    lat: 32.2805,
    lng: 78.0748,
    byDate: series(
      [-6, -7, -7, -7, -8, -8, -9, -9, -9, -9, -8, -7, -7],
      [-18, -19, -19, -20, -20, -21, -21, -21, -22, -22, -21, -20, -20],
      ['Extreme altitude cold', 'Extreme', 'Extreme', 'Extreme', 'Extreme', 'Extreme', 'Homestay overnight', 'Extreme', 'Extreme', 'Extreme', 'Extreme', 'Extreme', 'Extreme'],
    ),
  },
  {
    placeId: 'kufri',
    name: 'Kufri',
    region: 'Return',
    alt: '2,510 m',
    lat: 31.0978,
    lng: 77.2674,
    byDate: series(
      [8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 5, 6, 6],
      [-1, -2, -2, -3, -3, -4, -4, -4, -5, -5, -4, -3, -3],
      ['Cool hills', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Cool', 'Pre-airport overnight', 'Pre-dawn Delhi drive', 'Cool'],
    ),
  },
];

export function formatTempC(n: number): string {
  const rounded = Math.round(n);
  return `${rounded > 0 ? '+' : ''}${rounded}°C`;
}

export function tempBand(lowC: number, highC: number): 'mild' | 'cool' | 'cold' | 'extreme' {
  if (lowC <= -15 || highC <= -5) return 'extreme';
  if (lowC <= -5 || highC <= 2) return 'cold';
  if (lowC <= 5 || highC <= 12) return 'cool';
  return 'mild';
}
