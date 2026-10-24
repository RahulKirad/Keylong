import {
  defaultItinerarySnapshot,
  deriveDayPlan,
  inferPlaceIsHalt,
  type Day,
  type Place,
  type ScheduleRow,
  type StayNight,
  type StayType,
  type TransportSegment,
  type TripMeta,
  type TripPhase,
} from './tripData';

export const ITINERARY_STORAGE_KEY = 'spiti-tour-2026-itinerary-v1';

export type ItineraryState = {
  tripMeta: TripMeta;
  places: Place[];
  days: Day[];
  tripPhases: TripPhase[];
  transportSegments: TransportSegment[];
  stayNights: StayNight[];
  safetyChecklist: string[];
};

function cloneDefaults(): ItineraryState {
  return structuredClone(defaultItinerarySnapshot) as ItineraryState;
}

function normalizeDay(day: Day): Day {
  const plan = deriveDayPlan(day.scheduleRows || []);
  return {
    ...day,
    scheduleRows: day.scheduleRows || [],
    time: plan.time,
    details: plan.details,
  };
}

function normalizeStayType(value: unknown): StayType {
  if (value === 'hotel' || value === 'homestay' || value === 'camping' || value === 'other') return value;
  return '';
}

function normalizePlace(place: Place): Place {
  return {
    ...place,
    tips: Array.isArray(place.tips) ? place.tips : [],
    isHalt: inferPlaceIsHalt(place),
    stayType: normalizeStayType((place as Place).stayType),
    stayName: typeof place.stayName === 'string' ? place.stayName : '',
  };
}

function matchPlaceForStayLocation(location: string, places: Place[]): Place | undefined {
  const loc = location.trim().toLowerCase();
  if (!loc) return undefined;
  return places.find((place) => {
    const name = place.name.toLowerCase();
    const short = name.split('(')[0].trim();
    return loc === name || loc === short || loc.includes(short) || short.includes(loc);
  });
}

/** Keep overnight checklist stay names aligned with Places stay / hotel column after Update trip. */
export function syncStayNightsFromPlaces(state: ItineraryState): ItineraryState {
  return {
    ...state,
    stayNights: state.stayNights.map((night) => {
      const place = matchPlaceForStayLocation(night.location, state.places);
      if (!place) return { ...night, stayName: night.stayName || '', stayType: night.stayType || '' };
      return {
        ...night,
        stayName: place.stayName || night.stayName || '',
        stayType: place.stayType || night.stayType || '',
      };
    }),
    days: state.days.map((day) => {
      const place = state.places.find((p) => day.ids.includes(p.id) && p.isHalt && p.stayName.trim());
      if (!place?.stayName.trim()) return day;
      const label = place.stayType
        ? `${place.name} · ${place.stayType}: ${place.stayName}`
        : `${place.name} · ${place.stayName}`;
      // Prefer property label when this day's stay text points at the place.
      if (!day.stay || day.stay.toLowerCase().includes(place.name.split('(')[0].trim().toLowerCase())) {
        return { ...day, stay: label };
      }
      return day;
    }),
  };
}

const PLACE_ALIASES: Record<string, string[]> = {
  pune: ['pune', 'pnq'],
  mumbai: ['mumbai', 'bandra', 'bdts'],
  delhi: ['delhi', 'nizamuddin', 'nzm', 'igi', 'indira gandhi'],
  shimla: ['shimla'],
  narkanda: ['narkanda', 'rampur', 'karcham'],
  sangla: ['sangla', 'baspa'],
  chitkul: ['chitkul'],
  kalpa: ['kalpa', 'reckong peo', 'reckong'],
  nako: ['nako', 'sumdo'],
  tabo: ['tabo'],
  kaza: ['kaza'],
  langza: ['langza'],
  kufri: ['kufri'],
};

export function resolvePlaceIdsFromText(text: string, places: Place[]): string[] {
  const lower = text.toLowerCase();
  const hits: { id: string; index: number }[] = [];
  for (const place of places) {
    const aliases = PLACE_ALIASES[place.id] || [place.name, place.id];
    let best = -1;
    for (const alias of aliases) {
      const index = lower.indexOf(alias.toLowerCase());
      if (index >= 0 && (best < 0 || index < best)) best = index;
    }
    const nameIndex = lower.indexOf(place.name.toLowerCase());
    if (nameIndex >= 0 && (best < 0 || nameIndex < best)) best = nameIndex;
    if (best >= 0) hits.push({ id: place.id, index: best });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((hit) => hit.id);
}

function isTrainRow(row: ScheduleRow): boolean {
  return /train|rail|bdts|nzm|22917/i.test(`${row.mode} ${row.activity} ${row.notes}`);
}

function isFlightRow(row: ScheduleRow): boolean {
  return /flight|airline|ai\d+|airport|del\b|pnq/i.test(`${row.mode} ${row.activity} ${row.notes}`);
}

/** Derive day summaries, map place ids, halt flags, and train/flight meta from editable tables. */
export function enrichItineraryState(input: ItineraryState): ItineraryState {
  const places = input.places.map(normalizePlace);
  const days = input.days.map((day) => {
    const scheduleRows = day.scheduleRows || [];
    const overnight =
      [...scheduleRows].reverse().find((row) => row.overnight.trim())?.overnight.trim() || day.stay;
    const modes = [...new Set(scheduleRows.map((row) => row.mode.trim()).filter(Boolean))];
    const blob = scheduleRows
      .map((row) => `${row.when} ${row.activity} ${row.overnight} ${row.notes}`)
      .join(' ');
    const resolvedIds = resolvePlaceIdsFromText(blob, places);
    const ids = resolvedIds.length ? resolvedIds : day.ids;
    const place =
      overnight ||
      (ids[ids.length - 1]
        ? places.find((item) => item.id === ids[ids.length - 1])?.name || day.place
        : day.place);
    return normalizeDay({
      ...day,
      scheduleRows,
      stay: overnight,
      transport: modes.join(' · ') || day.transport,
      place,
      ids,
      title: day.title,
    });
  });

  // Overnight / halt column text marks matching destinations as halts.
  const overnightNames = new Set(
    days
      .flatMap((day) => day.scheduleRows.map((row) => row.overnight.trim().toLowerCase()))
      .filter(Boolean),
  );
  const placesWithHalts = places.map((place) => {
    const name = place.name.trim().toLowerCase();
    const short = name.split('(')[0].trim();
    const mentioned =
      overnightNames.has(name) ||
      overnightNames.has(short) ||
      [...overnightNames].some((overnight) => overnight.includes(short) || short.includes(overnight));
    if (mentioned && !place.isHalt) {
      return {
        ...place,
        isHalt: true,
        kind: place.kind === 'En route' || place.kind === 'Optional excursion' ? 'Overnight halt' : place.kind,
      };
    }
    return place;
  });

  const trainRows = days.flatMap((day) => day.scheduleRows.filter(isTrainRow));
  const flightRows = days.flatMap((day) => day.scheduleRows.filter(isFlightRow));
  const trainSegment = input.transportSegments.find((segment) =>
    /train|mumbai.*delhi|delhi.*mumbai|22917/i.test(`${segment.segment} ${segment.mode}`),
  );
  const flightSegment = input.transportSegments.find((segment) =>
    /flight|delhi.*pune|pune.*delhi|ai\d+/i.test(`${segment.segment} ${segment.mode}`),
  );

  const tripMeta: TripMeta = {
    ...input.tripMeta,
    train:
      trainRows.length > 0
        ? trainRows.map((row) => `${row.when}: ${row.activity} · ${row.notes || row.mode}`).join(' | ')
        : trainSegment
          ? `${trainSegment.segment}: ${trainSegment.mode}. ${trainSegment.book}`
          : input.tripMeta.train,
    flight:
      flightRows.length > 0
        ? flightRows.map((row) => `${row.when}: ${row.activity} · ${row.notes || row.mode}`).join(' | ')
        : flightSegment
          ? `${flightSegment.segment}: ${flightSegment.mode}. ${flightSegment.book}`
          : input.tripMeta.flight,
    privateTransfer: input.transportSegments
      .filter((segment) => !/train|flight|pune → mumbai|mumbai → delhi|delhi → pune/i.test(segment.segment))
      .map((segment) => `${segment.segment}: ${segment.mode} (${segment.book})`)
      .join(' · ') || input.tripMeta.privateTransfer,
  };

  const enriched: ItineraryState = {
    ...input,
    places: placesWithHalts,
    days,
    tripMeta,
  };
  return syncStayNightsFromPlaces(enriched);
}

export function createHaltPlace(partial?: Partial<Place>): Place {
  const stamp = Date.now().toString(36);
  return normalizePlace({
    id: partial?.id || `halt-${stamp}`,
    name: partial?.name || 'New halt',
    lat: partial?.lat ?? 32.0,
    lng: partial?.lng ?? 78.0,
    alt: partial?.alt || '',
    region: partial?.region || 'Custom halt',
    kind: partial?.kind || 'Overnight halt',
    about: partial?.about || 'Custom overnight halt added from Trip tables.',
    tips: partial?.tips || ['Confirm road access, heating and meals'],
    isHalt: true,
    stayType: partial?.stayType || '',
    stayName: partial?.stayName || '',
  });
}

function replacePlaceName(text: string, from: string, to: string): string {
  if (!from || from === to || !text.includes(from)) return text;
  return text.split(from).join(to);
}

/** When a place is renamed in the Places table, rewrite that name across phases, days, transport and stays. */
export function applyPlaceNamePropagation(previous: ItineraryState, next: ItineraryState): ItineraryState {
  const renames: { from: string; to: string }[] = [];
  for (const place of next.places) {
    const old = previous.places.find((item) => item.id === place.id);
    if (!old) continue;
    const from = old.name.trim();
    const to = place.name.trim();
    if (!from || !to || from === to) continue;
    renames.push({ from, to });
    const shortFrom = from.split('(')[0].trim();
    const shortTo = to.split('(')[0].trim();
    if (shortFrom && shortTo && shortFrom !== from && shortFrom !== shortTo) {
      renames.push({ from: shortFrom, to: shortTo });
    }
  }
  if (!renames.length) return next;

  const rewrite = (text: string) =>
    renames.reduce((value, { from, to }) => replacePlaceName(value, from, to), text);

  return {
    ...next,
    tripMeta: {
      ...next.tripMeta,
      title: rewrite(next.tripMeta.title),
      train: rewrite(next.tripMeta.train),
      privateTransfer: rewrite(next.tripMeta.privateTransfer),
      flight: rewrite(next.tripMeta.flight),
    },
    tripPhases: next.tripPhases.map((phase) => ({
      ...phase,
      title: rewrite(phase.title),
      note: phase.note ? rewrite(phase.note) : phase.note,
    })),
    days: next.days.map((day) => ({
      ...day,
      title: rewrite(day.title),
      place: rewrite(day.place),
      stay: rewrite(day.stay),
      warning: day.warning ? rewrite(day.warning) : day.warning,
      scheduleRows: day.scheduleRows.map((row) => ({
        ...row,
        when: rewrite(row.when),
        activity: rewrite(row.activity),
        mode: rewrite(row.mode),
        notes: rewrite(row.notes),
        overnight: rewrite(row.overnight),
      })),
    })),
    transportSegments: next.transportSegments.map((segment) => ({
      ...segment,
      segment: rewrite(segment.segment),
      mode: rewrite(segment.mode),
      book: rewrite(segment.book),
    })),
    stayNights: next.stayNights.map((stay) => ({
      ...stay,
      location: rewrite(stay.location),
      priority: rewrite(stay.priority),
    })),
  };
}

export function applyItineraryDraft(draft: ItineraryState): void {
  const previous = structuredClone(state);
  const withRenames = applyPlaceNamePropagation(previous, structuredClone(draft));
  commit(enrichItineraryState(withRenames));
}

function applyFlightMigration(state: ItineraryState, base: ItineraryState): ItineraryState {
  if (state.tripMeta.flight.includes('AI9825')) return state;
  const defaultDay12 = base.days.find((day) => day.day === 12);
  const defaultStay = base.stayNights.find((stay) => stay.id === 's12');
  const defaultTransport = base.transportSegments.find((segment) => segment.id === 't11');
  return {
    ...state,
    tripMeta: { ...state.tripMeta, flight: base.tripMeta.flight },
    days: state.days.map((day) => {
      if (day.day !== 12 || !defaultDay12) return day;
      return normalizeDay({
        ...day,
        place: defaultDay12.place,
        transport: defaultDay12.transport,
        stay: defaultDay12.stay,
        warning: defaultDay12.warning,
        scheduleRows: day.scheduleRows.map((row) => {
          const seed = defaultDay12.scheduleRows.find((item) => item.id === row.id);
          if (!seed) return row;
          if (row.id === 'd12-4' || row.id === 'd12-5') return { ...seed };
          return row;
        }),
      });
    }),
    stayNights: state.stayNights.map((stay) =>
      stay.id === 's12' && defaultStay ? { ...defaultStay } : stay,
    ),
    transportSegments: state.transportSegments.map((segment) =>
      segment.id === 't11' && defaultTransport ? { ...defaultTransport } : segment,
    ),
  };
}

function normalizeState(raw: Partial<ItineraryState> | null | undefined): ItineraryState {
  const base = cloneDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const merged: ItineraryState = {
    tripMeta: { ...base.tripMeta, ...(raw.tripMeta || {}) },
    places:
      Array.isArray(raw.places) && raw.places.length
        ? raw.places.map((place) => normalizePlace(place as Place))
        : base.places.map(normalizePlace),
    days: (Array.isArray(raw.days) && raw.days.length ? raw.days : base.days).map(normalizeDay),
    tripPhases:
      Array.isArray(raw.tripPhases) && raw.tripPhases.length ? raw.tripPhases : base.tripPhases,
    transportSegments:
      Array.isArray(raw.transportSegments) && raw.transportSegments.length
        ? raw.transportSegments
        : base.transportSegments,
    stayNights:
      Array.isArray(raw.stayNights) && raw.stayNights.length ? raw.stayNights : base.stayNights,
    // Prefer expanded default guide when stored checklist is the old short list.
    safetyChecklist:
      Array.isArray(raw.safetyChecklist) && raw.safetyChecklist.length >= base.safetyChecklist.length
        ? raw.safetyChecklist
        : base.safetyChecklist,
  };
  return applyFlightMigration(merged, base);
}

function load(): ItineraryState {
  try {
    const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const next = normalizeState(JSON.parse(raw) as Partial<ItineraryState>);
    // Persist migrated flight once so PDF / tables stay in sync after refresh.
    if (!raw.includes('AI9825')) {
      try {
        localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    return next;
  } catch {
    return cloneDefaults();
  }
}

function persist(next: ItineraryState): void {
  try {
    localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode — keep in-memory state.
  }
  window.dispatchEvent(new CustomEvent('itinerary-updated'));
}

let state = typeof window !== 'undefined' ? load() : cloneDefaults();

function commit(next: ItineraryState): void {
  state = {
    ...next,
    days: next.days.map(normalizeDay),
  };
  persist(state);
}

export function getItineraryState(): ItineraryState {
  return state;
}

export function getTripMeta(): TripMeta {
  return state.tripMeta;
}

export function getPlaces(): Place[] {
  return state.places;
}

export function getDays(): Day[] {
  return state.days;
}

export function getTripPhases(): TripPhase[] {
  return state.tripPhases;
}

export function getTransportSegments(): TransportSegment[] {
  return state.transportSegments;
}

export function getStayNights(): StayNight[] {
  return state.stayNights;
}

export function getSafetyChecklist(): string[] {
  return state.safetyChecklist;
}

export function getDay(dayNumber: number): Day | undefined {
  return state.days.find((d) => d.day === dayNumber);
}

export function subscribeItinerary(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('itinerary-updated', handler);
  return () => window.removeEventListener('itinerary-updated', handler);
}

export function resetItineraryToDefaults(): void {
  commit(cloneDefaults());
}

export function updateTripMeta(patch: Partial<TripMeta>): void {
  commit({ ...state, tripMeta: { ...state.tripMeta, ...patch } });
}

export function updateDay(dayNumber: number, patch: Partial<Day>): void {
  commit({
    ...state,
    days: state.days.map((day) => (day.day === dayNumber ? normalizeDay({ ...day, ...patch }) : day)),
  });
}

export function updateScheduleRow(
  dayNumber: number,
  rowId: string,
  patch: Partial<ScheduleRow>,
): void {
  commit({
    ...state,
    days: state.days.map((day) => {
      if (day.day !== dayNumber) return day;
      const scheduleRows = day.scheduleRows.map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      );
      const lastOvernight = scheduleRows[scheduleRows.length - 1]?.overnight;
      return normalizeDay({
        ...day,
        scheduleRows,
        stay: lastOvernight?.trim() ? lastOvernight : day.stay,
      });
    }),
  });
}

export function addScheduleRow(dayNumber: number, afterRowId?: string): void {
  const newRow: ScheduleRow = {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    when: 'New time',
    activity: 'New activity',
    mode: 'Private cab',
    notes: '',
    overnight: '',
  };
  commit({
    ...state,
    days: state.days.map((day) => {
      if (day.day !== dayNumber) return day;
      const rows = [...day.scheduleRows];
      const index = afterRowId ? rows.findIndex((r) => r.id === afterRowId) : -1;
      if (index >= 0) rows.splice(index + 1, 0, newRow);
      else rows.push(newRow);
      return normalizeDay({ ...day, scheduleRows: rows });
    }),
  });
}

export function removeScheduleRow(dayNumber: number, rowId: string): void {
  commit({
    ...state,
    days: state.days.map((day) => {
      if (day.day !== dayNumber) return day;
      if (day.scheduleRows.length <= 1) return day;
      return normalizeDay({
        ...day,
        scheduleRows: day.scheduleRows.filter((row) => row.id !== rowId),
      });
    }),
  });
}

export function updateTransportSegment(id: string, patch: Partial<TransportSegment>): void {
  commit({
    ...state,
    transportSegments: state.transportSegments.map((segment) =>
      segment.id === id ? { ...segment, ...patch } : segment,
    ),
  });
}

export function updateStayNight(id: string, patch: Partial<StayNight>): void {
  commit({
    ...state,
    stayNights: state.stayNights.map((night) => (night.id === id ? { ...night, ...patch } : night)),
  });
}

export function updatePhase(id: string, patch: Partial<TripPhase>): void {
  commit({
    ...state,
    tripPhases: state.tripPhases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
  });
}
