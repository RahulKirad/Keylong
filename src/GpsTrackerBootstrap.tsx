import { useEffect } from 'react';
import { startGpsTrackerIfNeeded, stopGpsTracker } from './travellerLocationStore';

/** Starts battery-friendly GPS polling when the signed-in traveller has sharing on. */
export default function GpsTrackerBootstrap() {
  useEffect(() => {
    startGpsTrackerIfNeeded();
    return () => stopGpsTracker();
  }, []);
  return null;
}
