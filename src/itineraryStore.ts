import {
  defaultItinerarySnapshot,
  deriveDayPlan,
  type Day,
  type Place,
  type ScheduleRow,
  type StayNight,
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
    places: Array.isArray(raw.places) && raw.places.length ? raw.places : base.places,
    days: (Array.isArray(raw.days) && raw.days.length ? raw.days : base.days).map(normalizeDay),
    tripPhases:
      Array.isArray(raw.tripPhases) && raw.tripPhases.length ? raw.tripPhases : base.tripPhases,
    transportSegments:
      Array.isArray(raw.transportSegments) && raw.transportSegments.length
        ? raw.transportSegments
        : base.transportSegments,
    stayNights:
      Array.isArray(raw.stayNights) && raw.stayNights.length ? raw.stayNights : base.stayNights,
    safetyChecklist:
      Array.isArray(raw.safetyChecklist) && raw.safetyChecklist.length
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
