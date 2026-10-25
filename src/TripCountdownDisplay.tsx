import React from 'react';
import { Clock } from 'lucide-react';
import { formatCountdownShort, type TripCountdown } from './tripCountdown';

type Variant = 'nav' | 'hero' | 'inline';

type Props = {
  countdown: TripCountdown;
  variant?: Variant;
};

export default function TripCountdownDisplay({ countdown, variant = 'inline' }: Props) {
  if (variant === 'nav') {
    return (
      <div className="trip-countdown-nav" title="Until departure · 23 Dec 2026">
        <Clock size={14} aria-hidden />
        <span className="trip-countdown-nav-label">Departure</span>
        <strong>{countdown.isPast ? 'Started' : formatCountdownShort(countdown)}</strong>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="trip-countdown-hero" role="status" aria-live="polite">
        <div className="trip-countdown-hero-label">
          <Clock size={16} /> Countdown to departure
        </div>
        {countdown.isPast ? (
          <p className="trip-countdown-hero-past">Trip week is here — have an amazing Spiti winter.</p>
        ) : (
          <div className="trip-countdown-hero-grid">
            <div className="trip-countdown-unit">
              <strong>{countdown.days}</strong>
              <small>Days</small>
            </div>
            <div className="trip-countdown-unit">
              <strong>{countdown.hours}</strong>
              <small>Hours</small>
            </div>
            <div className="trip-countdown-unit">
              <strong>{countdown.minutes}</strong>
              <small>Minutes</small>
            </div>
          </div>
        )}
        <p className="trip-countdown-hero-sub">23 Dec 2026 · Pune → Mumbai → Delhi → mountains</p>
      </div>
    );
  }

  return (
    <span className="trip-countdown-inline">
      <Clock size={14} /> {countdown.isPast ? 'Departed' : formatCountdownShort(countdown)}
    </span>
  );
}
