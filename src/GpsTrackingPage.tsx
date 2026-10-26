import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Mountain, MapPinned, Navigation, RefreshCw } from 'lucide-react';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import NavCalculatorButton from './NavCalculatorButton';
import { TRIP_MAP_TILES } from './mapTiles';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import { supabaseConfigured } from './supabaseClient';
import {
  colourForTraveller,
  fetchTravellerLocationsFromCloud,
  getTravellerLocations,
  GPS_POLL_MS,
  isGpsSharingEnabled,
  isLocationFresh,
  setGpsSharingEnabled,
  subscribeTravellerLocations,
  type TravellerLocation,
} from './travellerLocationStore';

const TRIP_TITLE = 'Spiti Tour 2026 | Interactive Journey';

function formatAge(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

function travellerIcon(name: string, color: string, stale: boolean): L.DivIcon {
  const safe = name.replace(/[<>&"]/g, '');
  return L.divIcon({
    className: 'gps-traveller-marker',
    html: `<div class="gps-pin-wrap${stale ? ' is-stale' : ''}">
      <span class="gps-pin-label">${safe}</span>
      <span class="gps-pin-dot" style="background:${color};box-shadow:0 0 0 3px ${color}33"></span>
    </div>`,
    iconSize: [120, 44],
    iconAnchor: [60, 40],
  });
}

function FitTravellers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.setView([32.25, 78.0], 7);
    }
  }, [map, points]);
  return null;
}

export default function GpsTrackingPage() {
  const [signedIn, setSignedIn] = useState<string | null>(() => getSelectedTraveller());
  const [sharing, setSharing] = useState(() => isGpsSharingEnabled());
  const [rows, setRows] = useState<TravellerLocation[]>(() => getTravellerLocations());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Spiti Tour GPS tracking';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  useEffect(() => subscribeSelectedTraveller(setSignedIn), []);
  useEffect(() => subscribeTravellerLocations(() => {
    setRows(getTravellerLocations());
    setSharing(isGpsSharingEnabled());
  }), []);

  useEffect(() => {
    void fetchTravellerLocationsFromCloud();
    const id = window.setInterval(() => {
      void fetchTravellerLocationsFromCloud();
    }, Math.max(30_000, GPS_POLL_MS / 2));
    return () => window.clearInterval(id);
  }, []);

  const liveRows = useMemo(
    () => rows.filter((r) => r.sharing && Number.isFinite(r.lat) && Number.isFinite(r.lng) && (r.lat !== 0 || r.lng !== 0)),
    [rows],
  );

  const points = useMemo(
    () => liveRows.map((r) => [r.lat, r.lng] as [number, number]),
    [liveRows],
  );

  async function toggleShare(next: boolean) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await setGpsSharingEnabled(next);
      setSharing(next);
      setStatus(
        next
          ? 'GPS sharing on — updates about every 75s (low power). Keep this tab open or return later; tracking pauses when the screen is locked/hidden.'
          : 'GPS sharing off — others will no longer see your live dot.',
      );
      await fetchTravellerLocationsFromCloud();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change GPS sharing.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app expenses-app gps-app">
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
            <MapPinned size={16} />
            GPS tracking
          </div>
          <NavCalculatorButton />
        </div>
        <div className="site-nav-row expenses-page-subnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <SyncStatusBadge />
        </div>
      </header>

      <main className="main expenses-page-main gps-page-main">
        <section className="section gps-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">LIVE GROUP MAP</div>
              <h2>Traveller GPS</h2>
              <p>
                Signed in as <b>{signedIn || '…'}</b>. Turn on sharing to place your named dot on the map. Tracking uses
                low-accuracy fixes about every 75 seconds and pauses while the tab is hidden to save battery.
                {!supabaseConfigured ? ' Cloud sync is offline — locations stay on this device until Supabase is configured.' : ''}
              </p>
            </div>
          </div>

          <div className="gps-controls">
            <label className="gps-share-toggle">
              <input
                type="checkbox"
                checked={sharing}
                disabled={busy || !signedIn}
                onChange={(e) => void toggleShare(e.target.checked)}
              />
              <Navigation size={16} />
              <span>{sharing ? 'My GPS sharing is ON' : 'Enable my GPS sharing'}</span>
            </label>
            <button
              type="button"
              className="button pale"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void fetchTravellerLocationsFromCloud().finally(() => setBusy(false));
              }}
            >
              <RefreshCw size={14} /> Refresh map
            </button>
          </div>

          {error ? <p className="gps-status gps-status-error">{error}</p> : null}
          {status ? <p className="gps-status">{status}</p> : null}

          <div className="gps-layout">
            <div className="gps-map-frame">
              <MapContainer center={[32.25, 78.0]} zoom={7} scrollWheelZoom className="leaflet-map gps-leaflet">
                <TileLayer
                  attribution={TRIP_MAP_TILES.attribution}
                  url={TRIP_MAP_TILES.url}
                  maxZoom={TRIP_MAP_TILES.maxZoom}
                />
                <FitTravellers points={points} />
                {liveRows.map((row) => {
                  const color = colourForTraveller(row.personName);
                  const stale = !isLocationFresh(row);
                  return (
                    <Marker
                      key={row.personId}
                      position={[row.lat, row.lng]}
                      icon={travellerIcon(row.personName, color, stale)}
                    >
                      <Tooltip direction="top" offset={[0, -28]} permanent={false}>
                        {row.personName}
                      </Tooltip>
                      <Popup>
                        <strong>{row.personName}</strong>
                        <br />
                        Updated {formatAge(row.updatedAt)}
                        {row.accuracyM != null ? ` · ±${row.accuracyM}m` : ''}
                        {stale ? ' · may be stale' : ''}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            <aside className="gps-roster">
              <h3>On the map</h3>
              {liveRows.length === 0 ? (
                <p className="traveller-ledger-empty">
                  No live dots yet. Each traveller enables GPS after login on their phone.
                </p>
              ) : (
                <ul className="gps-roster-list">
                  {liveRows.map((row) => {
                    const color = colourForTraveller(row.personName);
                    const stale = !isLocationFresh(row);
                    const isYou =
                      signedIn && row.personName.toLowerCase() === signedIn.toLowerCase();
                    return (
                      <li key={row.personId} className={stale ? 'is-stale' : undefined}>
                        <span className="gps-roster-dot" style={{ background: color }} />
                        <div>
                          <strong>
                            {row.personName}
                            {isYou ? ' (you)' : ''}
                          </strong>
                          <span>
                            {formatAge(row.updatedAt)}
                            {stale ? ' · stale' : ' · live'}
                            {row.accuracyM != null ? ` · ±${row.accuracyM}m` : ''}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          </div>
        </section>
        <footer className="footer">
          SPITI GPS <span>·</span> LOW-POWER POLL <span>·</span> NAMED DOTS PER TRAVELLER
        </footer>
      </main>
      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
