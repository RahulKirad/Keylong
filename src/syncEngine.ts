import { supabase } from './supabaseClient';
import {
  getExpenseState,
  setExpenseStateFromServer,
  ExpenseStoreState,
  ExpenseRecord,
  FundTransfer,
  TripMember,
} from './expenseStore';
import {
  getAssignmentState,
  setAssignmentStateFromServer,
  TripAssignment,
} from './assignmentStore';
import { BUDGET_STORAGE_KEY, BudgetCategory } from './budgetData';

export type SyncStatusState = {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: number | null;
  serverVersion: number;
  message?: string;
};

let syncStatus: SyncStatusState = {
  status: 'syncing',
  lastSyncTime: null,
  serverVersion: 0,
};

const listeners = new Set<(status: SyncStatusState) => void>();

export function getSyncStatus(): SyncStatusState {
  return syncStatus;
}

export function subscribeSyncStatus(cb: (status: SyncStatusState) => void): () => void {
  listeners.add(cb);
  cb(syncStatus);
  return () => {
    listeners.delete(cb);
  };
}

function updateStatus(patch: Partial<SyncStatusState>) {
  syncStatus = { ...syncStatus, ...patch };
  listeners.forEach((cb) => {
    try {
      cb(syncStatus);
    } catch (e) {
      console.error('Error in sync status listener:', e);
    }
  });
  window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: syncStatus }));
}

let isSyncing = false;
let lastSyncHash = '';

function computeDataHash(data: {
  members: TripMember[];
  expenses: ExpenseRecord[];
  transfers: FundTransfer[];
  assignments: TripAssignment[];
  budget: any;
}): string {
  return JSON.stringify({
    m: data.members.length,
    e: data.expenses.length,
    t: data.transfers.length,
    a: data.assignments.length,
    b: data.budget ? 1 : 0,
  });
}

/** Pull complete database from Supabase and merge into local stores. */
export async function pullDatabase(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;
  updateStatus({ status: 'syncing' });

  try {
    const [membersRes, expensesRes, transfersRes, assignmentsRes, budgetRes] = await Promise.all([
      supabase.from('trip_members').select('*').order('created_at', { ascending: true }),
      supabase.from('trip_expenses').select('*').order('trip_date', { ascending: true }),
      supabase.from('trip_transfers').select('*').order('trip_date', { ascending: true }),
      supabase.from('trip_assignments').select('*'),
      supabase.from('trip_budget').select('*').eq('id', 'singleton').maybeSingle(),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (transfersRes.error) throw transfersRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (budgetRes.error) throw budgetRes.error;

    const members = (membersRes.data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
    }));

    const expenses = (expensesRes.data || []).map((r: any) => ({
      id: r.id,
      tripDate: r.trip_date || '',
      dateLabel: r.date_label || '',
      description: r.description || '',
      category: r.category || '',
      amountInr: r.amount_inr || 0,
      paidByPersonId: r.paid_by_person_id || '',
      paidByName: r.paid_by_name || '',
      paymentMethod: r.payment_method || 'unknown',
      spentFromBalance: Boolean(r.spent_from_balance),
      balanceHolderPersonId: r.balance_holder_person_id || undefined,
      balanceHolderName: r.balance_holder_name || undefined,
      givenByPersonId: r.given_by_person_id || undefined,
      givenByName: r.given_by_name || undefined,
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0,
      source: r.source || 'manual',
    }));

    const transfers = (transfersRes.data || []).map((r: any) => ({
      id: r.id,
      tripDate: r.trip_date || '',
      dateLabel: r.date_label || '',
      fromPersonId: r.from_person_id || '',
      fromPersonName: r.from_person_name || '',
      toPersonId: r.to_person_id || '',
      toPersonName: r.to_person_name || '',
      amountInr: r.amount_inr || 0,
      paymentMethod: r.payment_method || 'unknown',
      note: r.note || undefined,
      createdAt: r.created_at || 0,
      source: r.source || 'manual',
    }));

    const assignments = (assignmentsRes.data || []).map((r: any) => ({
      id: r.id,
      assigneePersonId: r.assignee_person_id || '',
      assigneeName: r.assignee_name || '',
      task: r.task || '',
      tripDayNumber: r.trip_day_number ?? undefined,
      dateLabel: r.date_label || undefined,
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0,
      source: r.source || 'manual',
    }));

    const budgetRow = budgetRes.data as any;
    const budget = budgetRow
      ? {
          categories: budgetRow.categories as BudgetCategory[],
          travelers: budgetRow.travelers || 2,
          tripTarget: budgetRow.trip_target || 0,
        }
      : null;

    const localExpenses = getExpenseState();
    const mergedExpenses: ExpenseStoreState = {
      members: members.length > 0 ? members : localExpenses.members,
      expenses,
      transfers,
      pending: localExpenses.pending || [],
    };
    setExpenseStateFromServer(mergedExpenses);

    setAssignmentStateFromServer({ assignments });

    if (budget && budget.categories && budget.categories.length > 0) {
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
        window.dispatchEvent(new CustomEvent('budget-updated', { detail: budget }));
      } catch (err) {
        console.warn('Could not cache budget locally:', err);
      }
    }

    const hash = computeDataHash({ members, expenses, transfers, assignments, budget });
    const version = expenses.length + transfers.length + assignments.length + members.length;
    lastSyncHash = hash;

    updateStatus({
      status: 'synced',
      lastSyncTime: Date.now(),
      serverVersion: version,
      message: 'Universal cloud database up to date',
    });
    return true;
  } catch (err: any) {
    console.warn('Sync failed:', err);
    updateStatus({
      status: navigator.onLine ? 'error' : 'offline',
      message: navigator.onLine ? 'Could not reach cloud database' : 'Offline mode — changes cached locally',
    });
    return false;
  } finally {
    isSyncing = false;
  }
}

/** Check if server has newer data by comparing row counts. */
export async function checkServerStatus(): Promise<void> {
  if (isSyncing) return;
  try {
    const [membersRes, expensesRes, transfersRes, assignmentsRes] = await Promise.all([
      supabase.from('trip_members').select('id', { count: 'exact', head: true }),
      supabase.from('trip_expenses').select('id', { count: 'exact', head: true }),
      supabase.from('trip_transfers').select('id', { count: 'exact', head: true }),
      supabase.from('trip_assignments').select('id', { count: 'exact', head: true }),
    ]);

    if (membersRes.error || expensesRes.error || transfersRes.error || assignmentsRes.error) {
      if (syncStatus.status !== 'error') {
        updateStatus({ status: 'error', message: 'Cloud database unreachable' });
      }
      return;
    }

    const serverVersion =
      (membersRes.count || 0) +
      (expensesRes.count || 0) +
      (transfersRes.count || 0) +
      (assignmentsRes.count || 0);

    if (serverVersion !== syncStatus.serverVersion) {
      await pullDatabase();
    } else {
      if (syncStatus.status !== 'synced') {
        updateStatus({
          status: 'synced',
          lastSyncTime: Date.now(),
          serverVersion,
        });
      }
    }
  } catch (err) {
    if (syncStatus.status !== 'offline') {
      updateStatus({ status: navigator.onLine ? 'error' : 'offline' });
    }
  }
}

/** Push local state to Supabase via upsert. */
export async function pushSync(): Promise<boolean> {
  if (!navigator.onLine) {
    updateStatus({ status: 'offline', message: 'Offline: changes saved locally' });
    return false;
  }

  updateStatus({ status: 'syncing' });
  const exp = getExpenseState();
  const asg = getAssignmentState();
  let budgetData: { categories: BudgetCategory[]; travelers: number; tripTarget: number } | null = null;
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (raw) budgetData = JSON.parse(raw);
  } catch (e) {
    // Ignore budget parsing error
  }

  try {
    const memberRows = exp.members.map((m) => ({ id: m.id, name: m.name }));

    const expenseRows = exp.expenses.map((e) => ({
      id: e.id,
      trip_date: e.tripDate,
      date_label: e.dateLabel,
      description: e.description,
      category: e.category,
      amount_inr: e.amountInr,
      paid_by_person_id: e.paidByPersonId,
      paid_by_name: e.paidByName,
      payment_method: e.paymentMethod,
      spent_from_balance: e.spentFromBalance,
      balance_holder_person_id: e.balanceHolderPersonId || null,
      balance_holder_name: e.balanceHolderName || null,
      given_by_person_id: e.givenByPersonId || null,
      given_by_name: e.givenByName || null,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      source: e.source,
    }));

    const transferRows = exp.transfers.map((t) => ({
      id: t.id,
      trip_date: t.tripDate,
      date_label: t.dateLabel,
      from_person_id: t.fromPersonId,
      from_person_name: t.fromPersonName,
      to_person_id: t.toPersonId,
      to_person_name: t.toPersonName,
      amount_inr: t.amountInr,
      payment_method: t.paymentMethod,
      note: t.note || null,
      created_at: t.createdAt,
      source: t.source,
    }));

    const assignmentRows = asg.assignments.map((a) => ({
      id: a.id,
      assignee_person_id: a.assigneePersonId,
      assignee_name: a.assigneeName,
      task: a.task,
      trip_day_number: a.tripDayNumber ?? null,
      date_label: a.dateLabel || null,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
      source: a.source,
    }));

    const promises: Promise<any>[] = [
      Promise.resolve(supabase.from('trip_members').upsert(memberRows, { onConflict: 'id' })),
      Promise.resolve(supabase.from('trip_expenses').upsert(expenseRows, { onConflict: 'id' })),
      Promise.resolve(supabase.from('trip_transfers').upsert(transferRows, { onConflict: 'id' })),
      Promise.resolve(supabase.from('trip_assignments').upsert(assignmentRows, { onConflict: 'id' })),
    ];

    if (budgetData) {
      promises.push(
        Promise.resolve(
          supabase.from('trip_budget').upsert(
            {
              id: 'singleton',
              categories: budgetData.categories,
              travelers: budgetData.travelers,
              trip_target: budgetData.tripTarget,
              updated_at: Date.now(),
            },
            { onConflict: 'id' },
          ),
        ),
      );
    }

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error) throw r.error;
    }

    const version = expenseRows.length + transferRows.length + assignmentRows.length + memberRows.length;
    updateStatus({
      status: 'synced',
      lastSyncTime: Date.now(),
      serverVersion: version,
      message: 'Saved to universal cloud database',
    });
    return true;
  } catch (err: any) {
    console.error('Push sync error:', err);
    updateStatus({
      status: 'error',
      message: 'Failed saving to cloud database. Cached on device.',
    });
    return false;
  }
}

// Background sync loop
let isEngineInitialized = false;
let pushDebounceTimer: any = null;
let realtimeChannel: any = null;

export function triggerDebouncedSync(): void {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushSync().catch(() => {});
  }, 500);
}

export function initSyncEngine(): void {
  if (isEngineInitialized) return;
  isEngineInitialized = true;

  window.addEventListener('trigger-cloud-sync', () => {
    triggerDebouncedSync();
  });

  pullDatabase().catch(() => {});

  // Realtime subscription — instantly pulls when another device changes data
  try {
    realtimeChannel = supabase
      .channel('trip-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_transfers' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_assignments' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_budget' }, () => {
        pullDatabase().catch(() => {});
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription failed, falling back to polling:', e);
  }

  // Polling fallback (every 5 seconds when tab is visible)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkServerStatus().catch(() => {});
    }
  }, 5000);

  window.addEventListener('online', () => {
    updateStatus({ status: 'syncing', message: 'Reconnected. Syncing...' });
    pushSync().then(() => pullDatabase());
  });

  window.addEventListener('offline', () => {
    updateStatus({ status: 'offline', message: 'Offline mode — changes cached locally' });
  });

  window.addEventListener('focus', () => {
    checkServerStatus().catch(() => {});
  });
}
