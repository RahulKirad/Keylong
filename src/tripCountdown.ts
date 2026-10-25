/** Trip kickoff: 23 Dec 2026 · Pune → Mumbai → train (plan day 1). */
export const TRIP_COUNTDOWN_ISO = '2026-12-23T06:00:00+05:30';

export type TripCountdown = {
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
  isPast: boolean;
  target: Date;
};

export function getTripCountdown(now = new Date(), targetIso = TRIP_COUNTDOWN_ISO): TripCountdown {
  const target = new Date(targetIso);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalHours: 0, isPast: true, target };
  }
  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, totalHours, isPast: false, target };
}

export function formatCountdownShort(c: TripCountdown): string {
  if (c.isPast) return 'Trip started';
  if (c.days > 0) return `${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`;
  return `${c.minutes}m`;
}

export function formatCountdownSentence(c: TripCountdown): string {
  if (c.isPast) return 'Your Spiti Tour 2026 departure day has arrived — safe travels!';
  const parts: string[] = [];
  if (c.days > 0) parts.push(`${c.days} day${c.days === 1 ? '' : 's'}`);
  parts.push(`${c.hours} hour${c.hours === 1 ? '' : 's'}`);
  if (c.days === 0) parts.push(`${c.minutes} minute${c.minutes === 1 ? '' : 's'}`);
  return `${parts.join(', ')} left until departure (23 Dec 2026).`;
}

const REMINDER_MODAL_KEY = 'spiti-countdown-modal-date';
const REMINDER_NOTIFY_KEY = 'spiti-countdown-notify-date';

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function wasReminderModalShownToday(): boolean {
  try {
    return localStorage.getItem(REMINDER_MODAL_KEY) === localDateKey();
  } catch {
    return false;
  }
}

export function markReminderModalShownToday(): void {
  try {
    localStorage.setItem(REMINDER_MODAL_KEY, localDateKey());
  } catch {
    /* ignore */
  }
}

export function wasNotificationSentToday(): boolean {
  try {
    return localStorage.getItem(REMINDER_NOTIFY_KEY) === localDateKey();
  } catch {
    return false;
  }
}

export function markNotificationSentToday(): void {
  try {
    localStorage.setItem(REMINDER_NOTIFY_KEY, localDateKey());
  } catch {
    /* ignore */
  }
}

export function tryShowDailyBrowserNotification(c: TripCountdown): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (wasNotificationSentToday()) return;
  try {
    const body = formatCountdownSentence(c);
    new Notification('Spiti Tour 2026', {
      body,
      tag: 'spiti-daily-countdown',
    });
    markNotificationSentToday();
  } catch {
    /* ignore */
  }
}
