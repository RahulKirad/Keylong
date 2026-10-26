import { supabase, supabaseConfigured } from './supabaseClient';
import {
  getExpenseState,
  setExpenseStateFromServer,
  ExpenseStoreState,
  ExpenseRecord,
  FundTransfer,
  TripMember,
  DebtSettlement,
} from './expenseStore';
import {
  getAssignmentState,
  setAssignmentStateFromServer,
  TripAssignment,
} from './assignmentStore';
import { BUDGET_STORAGE_KEY, BudgetCategory } from './budgetData';
import { collapseMembers } from './memberIdentity';
import {
  listTravellerProfiles,
  setTravellerProfilesFromServer,
  type TravellerProfile,
} from './travellerProfileStore';

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
/** Tables that 404'd on this project — skip until page reload after migrations. */
const missingTables = new Set<string>();

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string; status?: number };
  const blob = `${e.code || ''} ${e.message || ''} ${e.details || ''} ${e.hint || ''}`.toLowerCase();
  return (
    e.code === '42P01' ||
    e.code === 'PGRST205' ||
    e.status === 404 ||
    blob.includes('does not exist') ||
    blob.includes('could not find the table') ||
    blob.includes('schema cache')
  );
}

function noteMissingTable(table: string, err: unknown): void {
  if (!isMissingRelationError(err)) return;
  if (!missingTables.has(table)) {
    missingTables.add(table);
    console.warn(
      `[sync] Table "${table}" is missing on Supabase (404). Run supabase/APPLY_MISSING_TABLES.sql in the SQL Editor.`,
    );
  }
}

function mergeById<T extends { id: string }>(
  serverRows: T[],
  localRows: T[],
  touch: (row: T) => number,
): T[] {
  const map = new Map<string, T>();
  for (const row of serverRows) map.set(row.id, row);
  for (const row of localRows) {
    const existing = map.get(row.id);
    if (!existing) {
      // Keep local-only rows (just logged, not pushed yet) so they don't vanish on pull.
      map.set(row.id, row);
      continue;
    }
    if (touch(row) > touch(existing)) map.set(row.id, row);
  }
  return [...map.values()];
}

function computeDataHash(data: {
  members: TripMember[];
  expenses: ExpenseRecord[];
  transfers: FundTransfer[];
  assignments: TripAssignment[];
  settlements?: DebtSettlement[];
  budget: any;
}): string {
  const expenseTouch = (data.expenses || []).reduce(
    (max, e) => Math.max(max, e.updatedAt || e.createdAt || 0),
    0,
  );
  const settlementTouch = (data.settlements || []).reduce(
    (max, s) => Math.max(max, s.createdAt || 0),
    0,
  );
  return JSON.stringify({
    m: data.members.length,
    e: data.expenses.length,
    t: data.transfers.length,
    a: data.assignments.length,
    s: (data.settlements || []).length,
    et: expenseTouch,
    st: settlementTouch,
    b: data.budget ? 1 : 0,
  });
}

/** Shared fingerprint so every login detects the same expense / Splitwise revisions. */
function syncFingerprint(input: {
  members: number;
  expenses: number;
  transfers: number;
  assignments: number;
  settlements: number;
  expenseTouch: number;
  settlementTouch: number;
}): number {
  // Compact numeric version for poll compare (counts + second-resolution touches).
  const touch =
    Math.floor(Math.max(input.expenseTouch, input.settlementTouch) / 1000) % 1_000_000_000;
  return (
    input.members +
    input.expenses * 3 +
    input.transfers * 5 +
    input.assignments * 7 +
    input.settlements * 11 +
    touch
  );
}

function personId(id: string | undefined, remap: Map<string, string>): string {
  if (!id) return '';
  return remap.get(id) || id;
}

/** Delete repeated names from the shared database and point tasks and expenses at the one record that remains. */
async function removeDuplicateTravellers(
  rows: { id: string; name: string }[],
  remap: Map<string, string>,
): Promise<void> {
  const keep = new Set(collapseMembers(rows).members.map((member) => member.id));
  const dropIds = rows.map((row) => row.id).filter((id) => !keep.has(id));
  if (dropIds.length > 0) {
    const { error } = await supabase.from('trip_members').delete().in('id', dropIds);
    if (error) console.warn('Could not remove duplicate travellers:', error.message);
  }
  if (remap.size === 0) return;
  const writes = [...remap.entries()].flatMap(([from, to]) => [
    supabase.from('trip_assignments').update({ assignee_person_id: to }).eq('assignee_person_id', from),
    supabase.from('trip_expenses').update({ paid_by_person_id: to }).eq('paid_by_person_id', from),
    supabase.from('trip_expenses').update({ balance_holder_person_id: to }).eq('balance_holder_person_id', from),
    supabase.from('trip_expenses').update({ given_by_person_id: to }).eq('given_by_person_id', from),
    supabase.from('trip_transfers').update({ from_person_id: to }).eq('from_person_id', from),
    supabase.from('trip_transfers').update({ to_person_id: to }).eq('to_person_id', from),
    supabase.from('trip_settlements').update({ from_person_id: to }).eq('from_person_id', from),
    supabase.from('trip_settlements').update({ to_person_id: to }).eq('to_person_id', from),
  ]);
  const results = await Promise.all(writes);
  for (const result of results) {
    if (result.error) console.warn('Could not retarget traveller link:', result.error.message);
  }
}

/** Pull complete database from Supabase and merge into local stores. */
export async function pullDatabase(): Promise<boolean> {
  if (!supabaseConfigured) {
    updateStatus({
      status: 'offline',
      message: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file, then restart npm run dev.',
    });
    return false;
  }
  if (isSyncing) return false;
  isSyncing = true;
  updateStatus({ status: 'syncing' });

  try {
    const settlementsQuery = missingTables.has('trip_settlements')
      ? Promise.resolve({ data: null, error: { message: 'skipped missing table' } as any })
      : supabase.from('trip_settlements').select('*');
    const profilesQuery = missingTables.has('trip_traveller_profiles')
      ? Promise.resolve({ data: null, error: { message: 'skipped missing table' } as any })
      : supabase.from('trip_traveller_profiles').select('*');

    const [membersRes, expensesRes, transfersRes, assignmentsRes, budgetRes, settlementsRes, profilesRes] =
      await Promise.all([
        supabase.from('trip_members').select('*').order('created_at', { ascending: true }),
        supabase.from('trip_expenses').select('*').order('trip_date', { ascending: true }),
        supabase.from('trip_transfers').select('*').order('trip_date', { ascending: true }),
        supabase.from('trip_assignments').select('*'),
        supabase.from('trip_budget').select('*').eq('id', 'singleton').maybeSingle(),
        settlementsQuery,
        profilesQuery,
      ]);

    if (membersRes.error) throw membersRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (transfersRes.error) throw transfersRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (budgetRes.error) throw budgetRes.error;
    if (settlementsRes.error) noteMissingTable('trip_settlements', settlementsRes.error);
    if (profilesRes.error) noteMissingTable('trip_traveller_profiles', profilesRes.error);

    const rawMembers = (membersRes.data || []).map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
    }));
    const collapsed = collapseMembers(rawMembers);
    const members = collapsed.members;
    const remap = collapsed.remap;
    if (remap.size > 0 || members.length !== rawMembers.length) {
      await removeDuplicateTravellers(rawMembers, remap);
    }

    const expenses: ExpenseRecord[] = (expensesRes.data || []).map((r: any) => ({
      id: r.id,
      tripDate: r.trip_date || '',
      dateLabel: r.date_label || '',
      description: r.description || '',
      category: r.category || '',
      amountInr: r.amount_inr || 0,
      paidByPersonId: personId(r.paid_by_person_id, remap),
      paidByName: r.paid_by_name || '',
      paymentMethod: r.payment_method || 'unknown',
      spentFromBalance: Boolean(r.spent_from_balance),
      balanceHolderPersonId: personId(r.balance_holder_person_id, remap) || undefined,
      balanceHolderName: r.balance_holder_name || undefined,
      givenByPersonId: personId(r.given_by_person_id, remap) || undefined,
      givenByName: r.given_by_name || undefined,
      countInTotal: r.count_in_total !== false,
      splitEnabled: r.split_enabled !== false,
      splitExcludedPersonIds: Array.isArray(r.split_excluded_person_ids)
        ? (r.split_excluded_person_ids as string[])
            .map((id: string) => personId(id, remap) || id)
            .filter(Boolean)
        : [],
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0,
      source: r.source || 'manual',
    }));

    const transfers: FundTransfer[] = (transfersRes.data || []).map((r: any) => ({
      id: r.id,
      tripDate: r.trip_date || '',
      dateLabel: r.date_label || '',
      fromPersonId: personId(r.from_person_id, remap),
      fromPersonName: r.from_person_name || '',
      toPersonId: personId(r.to_person_id, remap),
      toPersonName: r.to_person_name || '',
      amountInr: r.amount_inr || 0,
      paymentMethod: r.payment_method || 'unknown',
      note: r.note || undefined,
      createdAt: r.created_at || 0,
      source: r.source || 'manual',
    }));

    const assignments = (assignmentsRes.data || []).map((r: any) => ({
      id: r.id,
      assigneePersonId: personId(r.assignee_person_id, remap),
      assigneeName: r.assignee_name || '',
      task: r.task || '',
      tripDayNumber: r.trip_day_number ?? undefined,
      dateLabel: r.date_label || undefined,
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0,
      source: r.source || 'manual',
    }));

    const budgetRow = budgetRes.data as any;
    const budget =
      budgetRow && Array.isArray(budgetRow.categories)
        ? {
            categories: budgetRow.categories as BudgetCategory[],
            travelers: budgetRow.travelers || 2,
            tripTarget: budgetRow.trip_target || 0,
          }
        : null;

    const localExpenses = getExpenseState();
    const serverSettlements: DebtSettlement[] =
      !settlementsRes.error && settlementsRes.data
        ? (settlementsRes.data || []).map((r: any) => ({
            id: r.id,
            fromPersonId: personId(r.from_person_id, remap),
            fromPersonName: r.from_person_name || '',
            toPersonId: personId(r.to_person_id, remap),
            toPersonName: r.to_person_name || '',
            amountInr: r.amount_inr || 0,
            note: r.note || undefined,
            expenseId: r.expense_id || undefined,
            paymentMethod: r.payment_method || 'unknown',
            createdAt: r.created_at || 0,
            source: r.source || 'manual',
          }))
        : [];
    const mergedExpenseRows = mergeById(
      expenses,
      localExpenses.expenses || [],
      (e) => e.updatedAt || e.createdAt || 0,
    );
    const mergedTransfers = mergeById(
      transfers,
      localExpenses.transfers || [],
      (t) => t.createdAt || 0,
    );
    const settlements = mergeById(
      serverSettlements,
      localExpenses.settlements || [],
      (s) => s.createdAt || 0,
    );
    const mergedExpenses: ExpenseStoreState = {
      members: members.length > 0 ? members : localExpenses.members,
      expenses: mergedExpenseRows,
      transfers: mergedTransfers,
      settlements,
      pending: localExpenses.pending || [],
    };
    setExpenseStateFromServer(mergedExpenses);

    setAssignmentStateFromServer({ assignments });

    if (!profilesRes.error && profilesRes.data) {
      const profiles: TravellerProfile[] = (profilesRes.data || []).map((r: any) => ({
        personId: personId(r.person_id, remap) || r.person_id,
        personName: r.person_name || '',
        photoDataUrl: r.photo_data_url || undefined,
        updatedAt: Number(r.updated_at) || 0,
      }));
      setTravellerProfilesFromServer(profiles);
    }

    if (budget && budget.categories && budget.categories.length > 0) {
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
        window.dispatchEvent(new CustomEvent('budget-updated', { detail: budget }));
      } catch (err) {
        console.warn('Could not cache budget locally:', err);
      }
    }

    const hash = computeDataHash({
      members,
      expenses: mergedExpenseRows,
      transfers: mergedTransfers,
      assignments,
      settlements,
      budget,
    });
    const expenseTouch = mergedExpenseRows.reduce(
      (max, e) => Math.max(max, e.updatedAt || e.createdAt || 0),
      0,
    );
    const settlementTouch = settlements.reduce((max, s) => Math.max(max, s.createdAt || 0), 0);
    const version = syncFingerprint({
      members: members.length,
      expenses: mergedExpenseRows.length,
      transfers: mergedTransfers.length,
      assignments: assignments.length,
      settlements: settlements.length,
      expenseTouch,
      settlementTouch,
    });
    lastSyncHash = hash;

    const missingNote =
      missingTables.size > 0
        ? ` · Run APPLY_MISSING_TABLES.sql for: ${[...missingTables].join(', ')}`
        : '';
    updateStatus({
      status: 'synced',
      lastSyncTime: Date.now(),
      serverVersion: version,
      message: `Universal cloud database up to date${missingNote}`,
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

/** Check if server has newer Splitwise / expense data (counts + latest touch times). */
export async function checkServerStatus(): Promise<void> {
  if (!supabaseConfigured || isSyncing) return;
  try {
    const skipSettlements = missingTables.has('trip_settlements');
    const [membersRes, expensesRes, transfersRes, assignmentsRes, settlementsRes, expenseTouchRes, settlementTouchRes] =
      await Promise.all([
        supabase.from('trip_members').select('id', { count: 'exact', head: true }),
        supabase.from('trip_expenses').select('id', { count: 'exact', head: true }),
        supabase.from('trip_transfers').select('id', { count: 'exact', head: true }),
        supabase.from('trip_assignments').select('id', { count: 'exact', head: true }),
        skipSettlements
          ? Promise.resolve({ data: null, count: 0, error: null as any })
          : supabase.from('trip_settlements').select('id', { count: 'exact', head: true }),
        supabase
          .from('trip_expenses')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1),
        skipSettlements
          ? Promise.resolve({ data: null, error: null as any })
          : supabase
              .from('trip_settlements')
              .select('created_at')
              .order('created_at', { ascending: false })
              .limit(1),
      ]);

    const hardError =
      membersRes.error || expensesRes.error || transfersRes.error || assignmentsRes.error;
    if (hardError) {
      if (syncStatus.status !== 'error') {
        updateStatus({ status: 'error', message: 'Cloud database unreachable' });
      }
      return;
    }

    if (settlementsRes.error) noteMissingTable('trip_settlements', settlementsRes.error);
    const settlementCount =
      settlementsRes.error || skipSettlements ? 0 : settlementsRes.count || 0;
    const expenseTouch = Number(expenseTouchRes.data?.[0]?.updated_at || 0);
    const settlementTouch =
      settlementsRes.error || skipSettlements
        ? 0
        : Number(settlementTouchRes.data?.[0]?.created_at || 0);

    const serverVersion = syncFingerprint({
      members: membersRes.count || 0,
      expenses: expensesRes.count || 0,
      transfers: transfersRes.count || 0,
      assignments: assignmentsRes.count || 0,
      settlements: settlementCount,
      expenseTouch,
      settlementTouch,
    });

    if (serverVersion !== syncStatus.serverVersion) {
      await pullDatabase();
    } else if (syncStatus.status !== 'synced') {
      updateStatus({
        status: 'synced',
        lastSyncTime: Date.now(),
        serverVersion,
      });
    }
  } catch (err) {
    if (syncStatus.status !== 'offline') {
      updateStatus({ status: navigator.onLine ? 'error' : 'offline' });
    }
  }
}

/** Push local state to Supabase via upsert. */
export async function pushSync(): Promise<boolean> {
  if (!supabaseConfigured) return false;
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
    const collapsed = collapseMembers(exp.members);
    const remap = collapsed.remap;
    const memberRows = collapsed.members.map((m) => ({ id: m.id, name: m.name }));

    const expenseRows = exp.expenses.map((e) => ({
      id: e.id,
      trip_date: e.tripDate,
      date_label: e.dateLabel,
      description: e.description,
      category: e.category,
      amount_inr: e.amountInr,
      paid_by_person_id: personId(e.paidByPersonId, remap),
      paid_by_name: e.paidByName,
      payment_method: e.paymentMethod,
      spent_from_balance: e.spentFromBalance,
      balance_holder_person_id: personId(e.balanceHolderPersonId, remap) || null,
      balance_holder_name: e.balanceHolderName || null,
      given_by_person_id: personId(e.givenByPersonId, remap) || null,
      given_by_name: e.givenByName || null,
      count_in_total: e.countInTotal !== false,
      split_enabled: e.splitEnabled !== false,
      split_excluded_person_ids: (e.splitExcludedPersonIds || [])
        .map((id) => personId(id, remap) || id)
        .filter(Boolean),
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      source: e.source,
    }));

    const transferRows = exp.transfers.map((t) => ({
      id: t.id,
      trip_date: t.tripDate,
      date_label: t.dateLabel,
      from_person_id: personId(t.fromPersonId, remap),
      from_person_name: t.fromPersonName,
      to_person_id: personId(t.toPersonId, remap),
      to_person_name: t.toPersonName,
      amount_inr: t.amountInr,
      payment_method: t.paymentMethod,
      note: t.note || null,
      created_at: t.createdAt,
      source: t.source,
    }));

    const settlementRows = (exp.settlements || []).map((s) => ({
      id: s.id,
      from_person_id: personId(s.fromPersonId, remap),
      from_person_name: s.fromPersonName,
      to_person_id: personId(s.toPersonId, remap),
      to_person_name: s.toPersonName,
      amount_inr: s.amountInr,
      note: s.note || null,
      expense_id: s.expenseId || null,
      payment_method: s.paymentMethod,
      created_at: s.createdAt,
      source: s.source,
    }));

    const profileRows = listTravellerProfiles().map((p) => ({
      person_id: personId(p.personId, remap) || p.personId,
      person_name: p.personName,
      photo_data_url: p.photoDataUrl || null,
      updated_at: p.updatedAt,
    }));

    const assignmentRows = asg.assignments.map((a) => ({
      id: a.id,
      assignee_person_id: personId(a.assigneePersonId, remap),
      assignee_name: a.assigneeName,
      task: a.task,
      trip_day_number: a.tripDayNumber ?? null,
      date_label: a.dateLabel || null,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
      source: a.source,
    }));

    type NamedUpsert = { table: string; optional?: boolean; run: () => PromiseLike<{ error: any }> };
    const upserts: NamedUpsert[] = [
      {
        table: 'trip_members',
        run: () => supabase.from('trip_members').upsert(memberRows, { onConflict: 'id' }),
      },
      {
        table: 'trip_expenses',
        run: () => supabase.from('trip_expenses').upsert(expenseRows, { onConflict: 'id' }),
      },
      {
        table: 'trip_transfers',
        run: () => supabase.from('trip_transfers').upsert(transferRows, { onConflict: 'id' }),
      },
      {
        table: 'trip_assignments',
        run: () => supabase.from('trip_assignments').upsert(assignmentRows, { onConflict: 'id' }),
      },
    ];
    if (!missingTables.has('trip_settlements')) {
      upserts.push({
        table: 'trip_settlements',
        optional: true,
        run: () => supabase.from('trip_settlements').upsert(settlementRows, { onConflict: 'id' }),
      });
    }
    if (profileRows.length && !missingTables.has('trip_traveller_profiles')) {
      upserts.push({
        table: 'trip_traveller_profiles',
        optional: true,
        run: () =>
          supabase.from('trip_traveller_profiles').upsert(profileRows, { onConflict: 'person_id' }),
      });
    }
    if (budgetData) {
      upserts.push({
        table: 'trip_budget',
        run: () =>
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
      });
    }

    const results = await Promise.all(upserts.map(async (u) => ({ ...u, result: await u.run() })));
    for (const item of results) {
      if (!item.result.error) continue;
      if (item.optional && isMissingRelationError(item.result.error)) {
        noteMissingTable(item.table, item.result.error);
        continue;
      }
      throw item.result.error;
    }

    const { data: serverMembers, error: memberListError } = await supabase
      .from('trip_members')
      .select('id, name')
      .order('created_at', { ascending: true });
    if (!memberListError && serverMembers) {
      const serverRows = serverMembers.map((row: { id: string; name: string }) => ({
        id: row.id,
        name: row.name,
      }));
      const serverCollapse = collapseMembers(serverRows);
      if (serverCollapse.remap.size > 0 || serverCollapse.members.length !== serverRows.length) {
        await removeDuplicateTravellers(serverRows, serverCollapse.remap);
      }
    }

    const expenseTouch = exp.expenses.reduce(
      (max, e) => Math.max(max, e.updatedAt || e.createdAt || 0),
      0,
    );
    const settlementTouch = (exp.settlements || []).reduce(
      (max, s) => Math.max(max, s.createdAt || 0),
      0,
    );
    const version = syncFingerprint({
      members: memberRows.length,
      expenses: expenseRows.length,
      transfers: transferRows.length,
      assignments: assignmentRows.length,
      settlements: settlementRows.length,
      expenseTouch,
      settlementTouch,
    });
    lastSyncHash = computeDataHash({
      members: collapsed.members,
      expenses: exp.expenses,
      transfers: exp.transfers,
      assignments: asg.assignments,
      settlements: exp.settlements || [],
      budget: budgetData,
    });
    updateStatus({
      status: 'synced',
      lastSyncTime: Date.now(),
      serverVersion: version,
      message: 'Saved to universal cloud — all travellers see the same Splitwise',
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

  if (!supabaseConfigured) {
    updateStatus({
      status: 'offline',
      message: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file, then restart npm run dev.',
    });
    return;
  }

  window.addEventListener('trigger-cloud-sync', () => {
    triggerDebouncedSync();
  });

  pullDatabase().catch(() => {});

  // Realtime — every login refreshes when expenses / mark-paid settlements change
  try {
    realtimeChannel = supabase
      .channel('trip-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_transfers' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_settlements' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_assignments' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, () => {
        pullDatabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_traveller_profiles' }, () => {
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
