import { useEffect, useState } from 'react';
import { getTripCountdown, type TripCountdown } from './tripCountdown';

export function useTripCountdown(): TripCountdown {
  const [countdown, setCountdown] = useState(() => getTripCountdown());

  useEffect(() => {
    const tick = () => setCountdown(getTripCountdown());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return countdown;
}
