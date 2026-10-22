import { getExpenseState, setExpenseStateFromServer, ExpenseStoreState, ExpenseRecord, FundTransfer } from './expenseStore';
import { getAssignmentState, setAssignmentStateFromServer, TripAssignment } from './assignmentStore';

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
let pollingTimer: any = null;

/** Pull complete database from universal server and merge into local stores. */
export async function pullDatabase(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;
  updateStatus({ status: 'syncing' });

  try {
    const res = await fetch('/api/database', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Invalid response from server');

    const serverDb = json.data;
    const version = json.version || 1;

    // Update expense store
    const localExpenses = getExpenseState();
    const mergedExpenses: ExpenseStoreState = {
      members: serverDb.members && serverDb.members.length > 0 ? serverDb.members : localExpenses.members,
      expenses: serverDb.expenses || [],
      transfers: serverDb.transfers || [],
      pending: localExpenses.pending || [],
    };
    setExpenseStateFromServer(mergedExpenses);

    // Update assignment store
    setAssignmentStateFromServer({
      assignments: serverDb.assignments || [],
    });

    // Update budget if available
    if (serverDb.budget && serverDb.budget.categories && serverDb.budget.categories.length > 0) {
      try {
        localStorage.setItem('winter-himachal-budget-v1', JSON.stringify(serverDb.budget));
        window.dispatchEvent(new CustomEvent('budget-updated', { detail: serverDb.budget }));
      } catch (err) {
        console.warn('Could not cache budget locally:', err);
      }
    }

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
      message: navigator.onLine ? 'Could not reach server database' : 'Offline mode — changes cached locally',
    });
    return false;
  } finally {
    isSyncing = false;
  }
}

/** Check server status and pull if newer version exists. */
export async function checkServerStatus(): Promise<void> {
  if (isSyncing) return;
  try {
    const res = await fetch('/api/sync/status', { cache: 'no-store' });
    if (!res.ok) {
      if (syncStatus.status !== 'error') {
        updateStatus({ status: 'error', message: 'Server database unreachable' });
      }
      return;
    }
    const data = await res.json();
    if (data.version && data.version > syncStatus.serverVersion) {
      // Newer changes exist on server (from another traveller)
      await pullDatabase();
    } else {
      if (syncStatus.status !== 'synced') {
        updateStatus({ status: 'synced', lastSyncTime: Date.now(), serverVersion: data.version || syncStatus.serverVersion });
      }
    }
  } catch (err) {
    if (syncStatus.status !== 'offline') {
      updateStatus({ status: navigator.onLine ? 'error' : 'offline' });
    }
  }
}

/** Push full or incremental local snapshot to universal database. */
export async function pushSync(): Promise<boolean> {
  if (!navigator.onLine) {
    updateStatus({ status: 'offline', message: 'Offline: changes saved locally' });
    return false;
  }

  updateStatus({ status: 'syncing' });
  const exp = getExpenseState();
  const asg = getAssignmentState();
  let budgetData = null;
  try {
    const raw = localStorage.getItem('winter-himachal-budget-v1');
    if (raw) budgetData = JSON.parse(raw);
  } catch (e) {
    // Ignore budget parsing error
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        members: exp.members,
        expenses: exp.expenses,
        transfers: exp.transfers,
        assignments: asg.assignments,
        budget: budgetData,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.version) {
      syncStatus.serverVersion = json.version;
      updateStatus({
        status: 'synced',
        lastSyncTime: Date.now(),
        serverVersion: json.version,
        message: 'Saved to universal cloud database',
      });
      return true;
    }
    return false;
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

export function triggerDebouncedSync(): void {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushSync().catch(() => {});
  }, 200);
}

export function initSyncEngine(): void {
  if (isEngineInitialized) return;
  isEngineInitialized = true;

  // Listen for local mutation triggers
  window.addEventListener('trigger-cloud-sync', () => {
    triggerDebouncedSync();
  });

  // Immediate pull
  pullDatabase().catch(() => {});

  // Fast polling interval (every 2.5 seconds when active)
  pollingTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkServerStatus().catch(() => {});
    }
  }, 2500);

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

