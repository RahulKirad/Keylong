import React, { useEffect, useState } from 'react';
import { Cloud, CloudCheck, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { getSyncStatus, pullDatabase, subscribeSyncStatus, SyncStatusState } from './syncEngine';

export default function SyncStatusBadge({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<SyncStatusState>(getSyncStatus);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus((s) => setStatus(s));
  }, []);

  async function handleManualSync(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setManualSyncing(true);
    await pullDatabase();
    setManualSyncing(false);
  }

  const isSpinning = status.status === 'syncing' || manualSyncing;

  let badgeColor = 'rgba(34, 197, 94, 0.15)';
  let textColor = '#22c55e';
  let label = 'Live Cloud Synced';
  let Icon = CloudCheck;

  if (status.status === 'syncing' || manualSyncing) {
    badgeColor = 'rgba(59, 130, 246, 0.15)';
    textColor = '#60a5fa';
    label = 'Syncing with cloud...';
    Icon = RefreshCw;
  } else if (status.status === 'offline') {
    badgeColor = 'rgba(245, 158, 11, 0.15)';
    textColor = '#f59e0b';
    label = 'Offline (cached locally)';
    Icon = WifiOff;
  } else if (status.status === 'error') {
    badgeColor = 'rgba(239, 68, 68, 0.15)';
    textColor = '#f87171';
    label = 'Reconnecting cloud...';
    Icon = AlertCircle;
  }

  return (
    <div
      className={`sync-status-badge${compact ? ' compact' : ''}`}
      style={{
        background: badgeColor,
        borderColor: `${textColor}40`,
        color: textColor,
      }}
      title={`${label}. Tap to refresh from the cloud.`}
      onClick={handleManualSync}
    >
      <Icon
        size={13}
        className={isSpinning ? 'animate-spin' : ''}
        style={{
          animation: isSpinning ? 'spin 1s linear infinite' : undefined,
          flexShrink: 0,
        }}
      />
      <span className="sync-status-label">{label}</span>
      {!compact && (
        <button
          type="button"
          onClick={handleManualSync}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            opacity: 0.8,
            marginLeft: '2px',
          }}
          title="Refresh now"
        >
          <RefreshCw size={11} className={isSpinning ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}
