import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  formatCountdownSentence,
  getTripCountdown,
  markReminderModalShownToday,
  tryShowDailyBrowserNotification,
  wasReminderModalShownToday,
} from './tripCountdown';
import { useTripCountdown } from './useTripCountdown';

/**
 * Once per calendar day (first visit), shows a mobile-friendly popup with time left.
 * Optional browser notification if the user has granted permission.
 */
export default function DailyTripReminder() {
  const countdown = useTripCountdown();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasReminderModalShownToday()) {
      tryShowDailyBrowserNotification(getTripCountdown());
      return;
    }
    const t = window.setTimeout(() => {
      setOpen(true);
      markReminderModalShownToday();
      tryShowDailyBrowserNotification(getTripCountdown());
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      tryShowDailyBrowserNotification(getTripCountdown());
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="daily-reminder-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-reminder-title"
      onClick={() => setOpen(false)}
    >
      <div className="daily-reminder-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="daily-reminder-close" aria-label="Close" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
        <div className="daily-reminder-icon" aria-hidden>
          <Bell size={28} />
        </div>
        <h2 id="daily-reminder-title">Spiti Tour 2026</h2>
        <p className="daily-reminder-body">{formatCountdownSentence(countdown)}</p>
        {!countdown.isPast && (
          <div className="daily-reminder-stats">
            <div>
              <strong>{countdown.days}</strong>
              <span>days</span>
            </div>
            <div>
              <strong>{countdown.hours}</strong>
              <span>hours</span>
            </div>
          </div>
        )}
        <p className="daily-reminder-hint">This reminder shows once per day when you open the trip link.</p>
        {'Notification' in window && Notification.permission === 'default' && (
          <button type="button" className="button dark daily-reminder-notify" onClick={enableNotifications}>
            <Bell size={15} /> Enable phone notifications
          </button>
        )}
        <button type="button" className="button pale daily-reminder-ok" onClick={() => setOpen(false)}>
          Got it
        </button>
      </div>
    </div>
  );
}
