import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Thermometer } from 'lucide-react';
import { formatTempC, PLACE_TEMP_PROFILES, TRIP_TEMP_FOCUS, type TempDayKey } from './temperatureData';
import { getTemperatureCache, resolveReading } from './temperatureStore';

function todayKey(): TempDayKey | null {
  const iso = new Date().toISOString().slice(0, 10);
  const hit = TRIP_TEMP_FOCUS.find((d) => d.dateKey === iso);
  return hit ? hit.dateKey : null;
}

/** Compact top-nav chip: tonight's / next Spiti stop high–low, links to full calendar. */
export default function NavTempBadge() {
  const summary = useMemo(() => {
    const cache = getTemperatureCache();
    const key = todayKey() || '2026-12-28';
    const focus = TRIP_TEMP_FOCUS.find((d) => d.dateKey === key) || TRIP_TEMP_FOCUS[5];
    const profile = PLACE_TEMP_PROFILES.find((p) => p.placeId === focus.placeId)!;
    const { reading } = resolveReading(profile, focus.dateKey, cache);
    return {
      label: focus.placeName.split(' / ')[0],
      date: focus.label.replace(/^.*?·\s*/, ''),
      high: formatTempC(reading.highC),
      low: formatTempC(reading.lowC),
    };
  }, []);

  return (
    <Link to="/temperature" className="nav-temp-badge" title="Open temperature calendar (works offline)">
      <Thermometer size={14} />
      <span className="nav-temp-place">{summary.label}</span>
      <span className="nav-temp-range">
        {summary.high} / {summary.low}
      </span>
    </Link>
  );
}
