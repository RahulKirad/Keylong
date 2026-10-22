import { days } from './tripData';
import { DEFAULT_TRAVELLER_NAMES } from './defaultTravellers';
import { findMemberByName, getExpenseState } from './expenseStore';
import { seedDefaultTravellersIfNeeded } from './travellerSeed';

export const ASSIGNMENT_STORAGE_KEY = 'winter-himachal-assignments-v1';

export type TripAssignment = {
  id: string;
  assigneePersonId: string;
  assigneeName: string;
  task: string;
  tripDayNumber?: number;
  dateLabel?: string;
  createdAt: number;
  updatedAt: number;
  source: 'manual' | 'voice' | 'ai' | 'offline';
};

export type AssignmentInput = {
  assigneePersonId: string;
  assigneeName: string;
  task: string;
  tripDayNumber?: number;
  dateLabel?: string;
  source: TripAssignment['source'];
};

type AssignmentState = {
  assignments: TripAssignment[];
};

function newId(): string {
  return `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function load(): AssignmentState {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
    if (!raw) return { assignments: [] };
    const parsed = JSON.parse(raw) as AssignmentState;
    return { assignments: parsed.assignments || [] };
  } catch {
    return { assignments: [] };
  }
}

function save(state: AssignmentState): void {
  localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('assignments-updated'));
  window.dispatchEvent(new CustomEvent('trigger-cloud-sync'));
}

let state = load();

export function setAssignmentStateFromServer(serverState: AssignmentState): void {
  state = {
    assignments: serverState.assignments || [],
  };
  localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('assignments-updated'));
}

export function getAssignmentState(): AssignmentState {
  return state;
}

export function subscribeAssignments(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('assignments-updated', handler);
  return () => window.removeEventListener('assignments-updated', handler);
}

export function resolveTripDayFromText(text: string): { tripDayNumber: number; dateLabel: string } | null {
  const lower = text.toLowerCase();
  const dayRef = lower.match(/\bday\s*(\d{1,2})\b/);
  if (dayRef) {
    const n = parseInt(dayRef[1], 10);
    const d = days.find((x) => x.day === n);
    if (d) return { tripDayNumber: d.day, dateLabel: d.date };
  }

  const ord = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (ord) {
    const num = parseInt(ord[1], 10);
    for (const d of days) {
      if (d.date.includes(`${num} Dec`) || d.date.includes(`${num} Jan`)) {
        return { tripDayNumber: d.day, dateLabel: d.date };
      }
    }
    if (num >= 23 && num <= 31) {
      const d = days.find((x) => x.date.toLowerCase().includes(`${num} dec`));
      if (d) return { tripDayNumber: d.day, dateLabel: d.date };
    }
    if (num >= 1 && num <= 3) {
      const d = days.find((x) => x.date.toLowerCase().includes(`${num} jan`));
      if (d) return { tripDayNumber: d.day, dateLabel: d.date };
    }
  }

  for (const d of days) {
    const dec = d.date.match(/(\d{1,2})\s*Dec/i);
    if (dec && lower.includes(`${dec[1]} dec`)) return { tripDayNumber: d.day, dateLabel: d.date };
    const jan = d.date.match(/(\d{1,2})\s*Jan/i);
    if (jan && lower.includes(`${jan[1]} jan`)) return { tripDayNumber: d.day, dateLabel: d.date };
  }

  return null;
}

export function resolveAssigneeFromText(text: string): string | undefined {
  seedDefaultTravellersIfNeeded();
  const lower = text.toLowerCase();
  for (const name of DEFAULT_TRAVELLER_NAMES) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  const { members } = getExpenseState();
  for (const m of members) {
    if (lower.includes(m.name.toLowerCase())) return m.name;
  }
  const m = text.match(/^([A-Za-z]+)\s+is\s+assigned/i);
  return m?.[1];
}

export function addAssignment(input: AssignmentInput): TripAssignment {
  const now = Date.now();
  const record: TripAssignment = {
    id: newId(),
    ...input,
    task: input.task.trim(),
    createdAt: now,
    updatedAt: now,
  };
  state = {
    ...state,
    assignments: [...state.assignments, record].sort((a, b) => {
      const da = a.tripDayNumber ?? 99;
      const db = b.tripDayNumber ?? 99;
      if (da !== db) return da - db;
      return a.assigneeName.localeCompare(b.assigneeName);
    }),
  };
  save(state);
  return record;
}

export function updateAssignment(id: string, patch: Partial<AssignmentInput>): void {
  state = {
    ...state,
    assignments: state.assignments.map((a) =>
      a.id === id ? { ...a, ...patch, task: patch.task !== undefined ? patch.task.trim() : a.task, updatedAt: Date.now() } : a,
    ),
  };
  save(state);
}

export async function deleteAssignment(id: string): Promise<void> {
  state = { ...state, assignments: state.assignments.filter((a) => a.id !== id) };
  save(state);
  try {
    const { supabase } = await import('./supabaseClient');
    await supabase.from('trip_assignments').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete assignment from cloud:', e);
  }
}

export function assignmentsForDay(tripDayNumber: number): TripAssignment[] {
  return state.assignments.filter((a) => a.tripDayNumber === tripDayNumber);
}

export function assignmentsForMember(memberId: string): TripAssignment[] {
  return state.assignments.filter((a) => a.assigneePersonId === memberId);
}

export function allAssignments(): TripAssignment[] {
  return [...state.assignments];
}

export function ensureAssigneeMember(name: string): { id: string; name: string } | undefined {
  seedDefaultTravellersIfNeeded();
  return findMemberByName(name);
}
