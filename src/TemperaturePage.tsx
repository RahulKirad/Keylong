import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Mountain,
  RefreshCw,
  Snowflake,
  Sun,
  Thermometer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import {
  PLACE_TEMP_PROFILES,
  TEMP_DATE_LABEL,
  tempBand,
  TRIP_TEMP_FOCUS,
  type TempDayKey,
  type TempReading,
} from './temperatureData';
import {
  getTemperatureCache,
  refreshTemperaturesOnline,
  resolveReading,
  subscribeTemperature,
  type TemperatureCache,
} from './temperatureStore';
import TempRouteMap from './TempRouteMap';

const TRIP_TITLE = 'Spiti Tour 2026 | Interactive Journey';

type RangeTab = 'today' | 'tomorrow' | 'trip';
type PanelMode = 'forecast' | 'conditions';

type DayCard = {
  dateKey: TempDayKey;
  label: string;
  shortDay: string;
  placeId: string;
  placeName: string;
  role: string;
  reading: TempReading;
  source: 'live-cache' | 'offline-typical';
  band: ReturnType<typeof tempBand>;
  condition: string;
  precipChance: number;
  sunrise: string;
  sunset: string;
  realFeel: number;
};

function shortWeekday(dateKey: TempDayKey): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

function fullWeekday(dateKey: TempDayKey): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

function sunTimes(placeId: string): { sunrise: string; sunset: string } {
  if (placeId === 'langza' || placeId === 'kaza' || placeId === 'nako' || placeId === 'tabo') {
    return { sunrise: '7:20 AM', sunset: '5:25 PM' };
  }
  if (placeId === 'shimla' || placeId === 'kufri' || placeId === 'sangla' || placeId === 'kalpa') {
    return { sunrise: '7:05 AM', sunset: '5:35 PM' };
  }
  if (placeId === 'delhi') return { sunrise: '7:10 AM', sunset: '5:30 PM' };
  return { sunrise: '6:55 AM', sunset: '6:05 PM' };
}

function conditionFor(band: ReturnType<typeof tempBand>, highC: number, placeId: string): string {
  if (band === 'extreme' || placeId === 'langza') return 'Bitter cold / snow risk';
  if (band === 'cold') return highC <= 0 ? 'Freezing clear spells' : 'Cold mountain air';
  if (band === 'cool') return 'Cool & crisp';
  return 'Mild plains weather';
}

function precipFor(band: ReturnType<typeof tempBand>, dateKey: TempDayKey): number {
  const seed = dateKey.split('-').reduce((n, p) => n + Number(p), 0);
  const base = band === 'extreme' ? 42 : band === 'cold' ? 28 : band === 'cool' ? 18 : 8;
  return Math.min(85, Math.max(5, base + (seed % 17) - 6));
}

function WeatherGlyph({ band, size = 36 }: { band: ReturnType<typeof tempBand>; size?: number }) {
  if (band === 'extreme') return <Snowflake size={size} strokeWidth={1.6} />;
  if (band === 'cold') return <CloudSnow size={size} strokeWidth={1.6} />;
  if (band === 'cool') return <CloudSun size={size} strokeWidth={1.6} />;
  return <Sun size={size} strokeWidth={1.6} />;
}

function dayIconVariant(index: number, band: ReturnType<typeof tempBand>) {
  const icons = [CloudLightning, CloudRain, CloudSun, CloudSnow, Cloud, CloudFog, Sun];
  if (band === 'extreme') return Snowflake;
  if (band === 'cold' && index % 2 === 0) return CloudSnow;
  return icons[index % icons.length];
}

function buildCards(cache: TemperatureCache | null): DayCard[] {
  return TRIP_TEMP_FOCUS.map((day) => {
    const profile = PLACE_TEMP_PROFILES.find((p) => p.placeId === day.placeId)!;
    const { reading, source } = resolveReading(profile, day.dateKey, cache);
    const band = tempBand(reading.lowC, reading.highC);
    const sun = sunTimes(day.placeId);
    return {
      dateKey: day.dateKey,
      label: day.label,
      shortDay: shortWeekday(day.dateKey),
      placeId: day.placeId,
      placeName: day.placeName.split(' / ')[0],
      role: day.role,
      reading,
      source,
      band,
      condition: conditionFor(band, reading.highC, day.placeId),
      precipChance: precipFor(band, day.dateKey),
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      realFeel: Math.round(reading.highC - (band === 'extreme' ? 6 : band === 'cold' ? 4 : 2)),
    };
  });
}

function pickAnchorIndex(cards: DayCard[]): number {
  const todayIso = new Date().toISOString().slice(0, 10);
  const idx = cards.findIndex((c) => c.dateKey === todayIso);
  if (idx >= 0) return idx;
  // Before the trip: highlight first Spiti overnight (Kaza arrive).
  const kaza = cards.findIndex((c) => c.dateKey === '2026-12-28');
  return kaza >= 0 ? kaza : 0;
}

const HOUR_LABELS = ['10AM', '11AM', '12PM', '01PM', '02PM', '03PM'];

export default function TemperaturePage() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cacheTick, setCacheTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  const [rangeTab, setRangeTab] = useState<RangeTab>('trip');
  const [panelMode, setPanelMode] = useState<PanelMode>('forecast');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
  );

  useEffect(() => {
    document.title = 'Spiti Tour 2026 — Temperature';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => subscribeTemperature(() => setCacheTick((n) => n + 1)), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const cache = useMemo(() => getTemperatureCache(), [cacheTick]);
  const cards = useMemo(() => buildCards(cache), [cache]);

  useEffect(() => {
    setSelectedIndex(pickAnchorIndex(cards));
  }, [cards]);

  useEffect(() => {
    const anchor = pickAnchorIndex(cards);
    if (rangeTab === 'today') setSelectedIndex(anchor);
    if (rangeTab === 'tomorrow') setSelectedIndex(Math.min(cards.length - 1, anchor + 1));
  }, [rangeTab, cards]);

  const selected = cards[selectedIndex] || cards[0];

  const stripDays = useMemo(() => {
    if (rangeTab === 'today') return [cards[selectedIndex]].filter(Boolean);
    if (rangeTab === 'tomorrow') return [cards[selectedIndex]].filter(Boolean);
    const start = Math.max(0, Math.min(selectedIndex, Math.max(0, cards.length - 7)));
    return cards.slice(start, start + 7);
  }, [cards, rangeTab, selectedIndex]);

  const otherPlaces = useMemo(() => {
    const focusId = selected?.placeId;
    const list = PLACE_TEMP_PROFILES.filter((p) => p.placeId !== focusId).map((profile) => {
      const { reading } = resolveReading(profile, selected.dateKey, cache);
      const band = tempBand(reading.lowC, reading.highC);
      return {
        profile,
        reading,
        band,
        condition: conditionFor(band, reading.highC, profile.placeId),
      };
    });
    return showAllPlaces ? list : list.slice(0, 3);
  }, [cache, selected, showAllPlaces]);

  const rainBars = useMemo(() => {
    const base = selected?.precipChance ?? 20;
    return HOUR_LABELS.map((_, i) => {
      const wobble = [0, 12, -8, 18, 5, -4][i];
      return Math.min(92, Math.max(8, base + wobble));
    });
  }, [selected]);

  async function refresh() {
    setRefreshing(true);
    setStatus('');
    try {
      const result = await refreshTemperaturesOnline();
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not refresh temperatures.');
    } finally {
      setRefreshing(false);
    }
  }

  const cacheLabel = cache?.fetchedAt
    ? `Live cache · ${new Date(cache.fetchedAt).toLocaleString('en-IN')}`
    : 'Offline winter typicals';

  return (
    <div className="app wx-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>SPITI</strong>
              <span className="brand-sub">TOUR 2026</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <Thermometer size={16} />
            Temperature · 23 Dec – 4 Jan
          </div>
        </div>
        <div className="site-nav-row expenses-page-subnav temperature-subnav">
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <div className="temperature-subnav-right">
            <span className={`temperature-net ${online ? 'on' : 'off'}`}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {online ? 'Online' : 'Offline'}
            </span>
            <SyncStatusBadge />
          </div>
        </div>
      </header>

      <main className="wx-main">
        <div className="wx-shell">
          <div className="wx-topbar">
            <nav className="wx-range-tabs" aria-label="Forecast range">
              <button type="button" className={rangeTab === 'today' ? 'on' : ''} onClick={() => setRangeTab('today')}>
                Today
              </button>
              <button
                type="button"
                className={rangeTab === 'tomorrow' ? 'on' : ''}
                onClick={() => setRangeTab('tomorrow')}
              >
                Tomorrow
              </button>
              <button type="button" className={rangeTab === 'trip' ? 'on' : ''} onClick={() => setRangeTab('trip')}>
                Next 7 days
              </button>
            </nav>

            <div className="wx-mode-toggle" role="tablist" aria-label="Panel mode">
              <button
                type="button"
                role="tab"
                aria-selected={panelMode === 'forecast'}
                className={panelMode === 'forecast' ? 'on' : ''}
                onClick={() => setPanelMode('forecast')}
              >
                Forecast
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelMode === 'conditions'}
                className={panelMode === 'conditions' ? 'on' : ''}
                onClick={() => setPanelMode('conditions')}
              >
                Conditions
              </button>
            </div>

            <button
              type="button"
              className="wx-refresh"
              onClick={refresh}
              disabled={refreshing || !online}
              title={cacheLabel}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : undefined} />
              {refreshing ? 'Updating' : 'Refresh'}
            </button>
          </div>

          {status ? <p className="wx-status">{status}</p> : null}

          {panelMode === 'forecast' ? (
            <>
              <div className="wx-grid-top">
                <section className="wx-forecast-block">
                  <article className="wx-hero-card">
                    <header>
                      <div>
                        <h2>{fullWeekday(selected.dateKey)}</h2>
                        <p>
                          {TEMP_DATE_LABEL[selected.dateKey]} · {selected.placeName}
                        </p>
                      </div>
                      <time>{clock}</time>
                    </header>
                    <div className="wx-hero-temp-row">
                      <div className="wx-hero-temp">
                        {Math.round(selected.reading.highC)}
                        <span>°</span>
                      </div>
                      <div className="wx-hero-icon">
                        <WeatherGlyph band={selected.band} size={56} />
                      </div>
                    </div>
                    <ul className="wx-hero-meta">
                      <li>Real feel: {selected.realFeel}°</li>
                      <li>
                        Low {Math.round(selected.reading.lowC)}° · {selected.condition}
                      </li>
                      <li>Sunrise: {selected.sunrise}</li>
                      <li>Sunset: {selected.sunset}</li>
                    </ul>
                    <p className="wx-hero-source">
                      {selected.source === 'live-cache' ? 'Cached live reading' : 'Offline winter typical'} ·{' '}
                      {selected.role}
                    </p>
                  </article>

                  <div className="wx-day-strip" role="list">
                    {stripDays.map((day) => {
                      const globalIndex = cards.findIndex((c) => c.dateKey === day.dateKey);
                      const Icon = dayIconVariant(globalIndex, day.band);
                      const active = day.dateKey === selected.dateKey;
                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          role="listitem"
                          className={`wx-day-card${active ? ' on' : ''}`}
                          onClick={() => setSelectedIndex(globalIndex)}
                        >
                          <span className="wx-day-name">{day.shortDay}</span>
                          <span className="wx-day-icon">
                            <Icon size={28} strokeWidth={1.5} />
                          </span>
                          <span className="wx-day-temp">{Math.round(day.reading.highC)}°</span>
                          <span className="wx-day-date">{TEMP_DATE_LABEL[day.dateKey]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="wx-rain-card">
                  <h3>Chance of precip</h3>
                  <div className="wx-rain-chart" aria-hidden="true">
                    <div className="wx-rain-ylabels">
                      <span>Heavy</span>
                      <span>Snowy</span>
                      <span>Clear</span>
                    </div>
                    <div className="wx-rain-plot">
                      {rainBars.map((pct, i) => (
                        <div key={HOUR_LABELS[i]} className="wx-rain-col">
                          <div className="wx-rain-track">
                            <div className="wx-rain-bar" style={{ height: `${pct}%` }}>
                              <span className="wx-rain-cap" />
                            </div>
                          </div>
                          <span className="wx-rain-x">{HOUR_LABELS[i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="wx-rain-note">
                    Estimated winter precip risk for <b>{selected.placeName}</b> on{' '}
                    {TEMP_DATE_LABEL[selected.dateKey]} (~{selected.precipChance}%). Works offline from trip seed
                    data.
                  </p>
                </section>
              </div>

              <div className="wx-grid-bottom">
                <section className="wx-map-card">
                  <header className="wx-map-head">
                    <h3>Trip route map</h3>
                    <Link to="/#map" className="wx-map-wide">
                      View wide
                    </Link>
                  </header>
                  <div className="wx-map-stage">
                    <TempRouteMap
                      selectedPlaceId={selected.placeId}
                      online={online}
                      onSelectPlace={(placeId) => {
                        const idx = cards.findIndex((c) => c.placeId === placeId);
                        if (idx >= 0) setSelectedIndex(idx);
                      }}
                    />
                    <aside className="wx-map-cta">
                      <p>
                        Explore overnight stops from Shimla through Spiti to Kufri — temps update with the day you
                        pick.
                      </p>
                      <button
                        type="button"
                        className="wx-cta-btn"
                        onClick={() => {
                          const langza = cards.findIndex((c) => c.placeId === 'langza');
                          if (langza >= 0) setSelectedIndex(langza);
                        }}
                      >
                        Jump to Langza
                      </button>
                    </aside>
                  </div>
                </section>

                <section className="wx-cities-card">
                  <header className="wx-cities-head">
                    <h3>Other trip places</h3>
                    <button type="button" className="wx-show-all" onClick={() => setShowAllPlaces((v) => !v)}>
                      {showAllPlaces ? 'Show less' : 'Show All'}
                    </button>
                  </header>
                  <ul className="wx-city-list">
                    {otherPlaces.map(({ profile, reading, band, condition }) => (
                      <li key={profile.placeId}>
                        <button
                          type="button"
                          className="wx-city-row"
                          onClick={() => {
                            const idx = cards.findIndex((c) => c.placeId === profile.placeId);
                            if (idx >= 0) setSelectedIndex(idx);
                          }}
                        >
                          <div className="wx-city-copy">
                            <span className="wx-city-region">{profile.region}</span>
                            <strong>{profile.name}</strong>
                            <span className="wx-city-cond">{condition}</span>
                          </div>
                          <div className="wx-city-right">
                            <span className="wx-city-icon">
                              <WeatherGlyph band={band} size={28} />
                            </span>
                            <span className="wx-city-temp">{Math.round(reading.highC)}°</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : (
            <>
              <section className="wx-conditions-panel">
                <div className="wx-conditions-hero">
                  <h2>
                    {selected.placeName} · {TEMP_DATE_LABEL[selected.dateKey]}
                  </h2>
                  <p>{selected.condition}</p>
                  <div className="wx-conditions-stats">
                    <article>
                      <span>High</span>
                      <strong>{Math.round(selected.reading.highC)}°</strong>
                    </article>
                    <article>
                      <span>Low</span>
                      <strong>{Math.round(selected.reading.lowC)}°</strong>
                    </article>
                    <article>
                      <span>Real feel</span>
                      <strong>{selected.realFeel}°</strong>
                    </article>
                    <article>
                      <span>Precip risk</span>
                      <strong>{selected.precipChance}%</strong>
                    </article>
                  </div>
                  <p className="wx-conditions-note">{selected.reading.note}</p>
                </div>
                <div className="wx-conditions-table-wrap">
                  <table className="wx-conditions-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Place</th>
                        <th>High</th>
                        <th>Low</th>
                        <th>Band</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cards.map((day, i) => (
                        <tr
                          key={day.dateKey}
                          className={i === selectedIndex ? 'on' : ''}
                          onClick={() => setSelectedIndex(i)}
                        >
                          <td>{day.label}</td>
                          <td>{day.placeName}</td>
                          <td>{Math.round(day.reading.highC)}°</td>
                          <td>{Math.round(day.reading.lowC)}°</td>
                          <td>
                            <span className={`wx-band ${day.band}`}>{day.band}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="wx-map-card wx-conditions-map">
                <header className="wx-map-head">
                  <h3>Trip route map</h3>
                  <Link to="/#map" className="wx-map-wide">
                    View wide
                  </Link>
                </header>
                <div className="wx-map-stage">
                  <TempRouteMap
                    selectedPlaceId={selected.placeId}
                    online={online}
                    wide
                    onSelectPlace={(placeId) => {
                      const idx = cards.findIndex((c) => c.placeId === placeId);
                      if (idx >= 0) setSelectedIndex(idx);
                    }}
                  />
                </div>
              </section>
            </>
          )}

          <p className="wx-foot-note">{cacheLabel} · Fully usable with no network coverage.</p>
        </div>
      </main>

      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
