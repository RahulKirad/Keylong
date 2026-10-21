import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CarFront, Play, Square } from 'lucide-react';
import { bearingAlongPath, fetchRoadRoute, LatLng, pointAlongPath } from './routeUtils';

export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: string;
};

const pinIcon = L.divIcon({
  className: 'custom-pin',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 8 });
    else if (points.length === 1) map.setView(points[0], 9);
  }, [points, map]);
  return null;
}

function VehicleLayer({
  path,
  playing,
  onDone,
}: {
  path: LatLng[];
  playing: boolean;
  onDone: () => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const vehicleIcon = useCallback(
    (deg: number) =>
      L.divIcon({
        className: 'vehicle-marker',
        html: `<div class="vehicle-pin" style="transform:rotate(${deg}deg)"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17384b" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-5.4A2 2 0 0 0 13.7 3H10.3a2 2 0 0 0-1.6.9L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    [],
  );

  useEffect(() => {
    if (!path.length) return;
    const start = path[0];
    const icon = vehicleIcon(0);
    if (!markerRef.current) {
      markerRef.current = L.marker(start, { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      markerRef.current.setLatLng(start);
      markerRef.current.setIcon(icon);
    }
  }, [map, path, vehicleIcon]);

  useEffect(() => {
    if (!playing || path.length < 2 || !markerRef.current) return;
    const durationMs = Math.min(28000, Math.max(6000, path.length * 35));
    startRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const pos = pointAlongPath(path, t);
      const bearing = bearingAlongPath(path, t);
      markerRef.current?.setLatLng(pos);
      markerRef.current?.setIcon(vehicleIcon(bearing));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else onDone();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, path, onDone, vehicleIcon]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    },
    [map],
  );

  return null;
}

type TripMapProps = {
  waypoints: LatLng[];
  places: MapPlace[];
  onSelectPlace: (id: string) => void;
};

export default function TripMap({ waypoints, places, onSelectPlace }: TripMapProps) {
  const [roadPath, setRoadPath] = useState<LatLng[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [routeError, setRouteError] = useState(false);

  const waypointKey = waypoints.map((p) => p.join(',')).join('|');

  useEffect(() => {
    setPlaying(false);
    if (waypoints.length < 2) {
      setRoadPath([]);
      setRouteError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRouteError(false);
    fetchRoadRoute(waypoints).then((path) => {
      if (cancelled) return;
      setRoadPath(path);
      setLoading(false);
      if (path.length < 2) setRouteError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [waypointKey, waypoints]);

  const startDrive = useCallback(() => {
    if (roadPath.length >= 2) setPlaying(true);
  }, [roadPath]);

  const displayPath = roadPath.length >= 2 ? roadPath : waypoints;

  return (
    <div className="map-frame">
      <MapContainer center={[32.3, 77.15]} zoom={7} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={displayPath.length ? displayPath : waypoints} />
        {displayPath.length > 1 && (
          <Polyline
            positions={displayPath}
            pathOptions={{ color: '#d34a32', weight: 6, opacity: 0.92 }}
            eventHandlers={{
              click: () => startDrive(),
            }}
          />
        )}
        {displayPath.length > 1 && (
          <Polyline
            positions={displayPath}
            pathOptions={{ color: 'transparent', weight: 18, opacity: 0 }}
            eventHandlers={{ click: () => startDrive() }}
          />
        )}
        <VehicleLayer path={roadPath} playing={playing} onDone={() => setPlaying(false)} />
        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon}
            eventHandlers={{
              click: () => {
                onSelectPlace(p.id);
                startDrive();
              },
            }}
          >
            <Popup>
              <b>{p.name}</b>
              <br />
              {p.kind}
              <br />
              <button type="button" onClick={() => onSelectPlace(p.id)}>Trip details</button>
              <br />
              <button type="button" onClick={() => startDrive()}>Drive route</button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-toolbar">
        <button
          type="button"
          className="map-drive-btn"
          disabled={loading || displayPath.length < 2}
          onClick={() => (playing ? setPlaying(false) : startDrive())}
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
          {playing ? 'Stop' : 'Drive route'}
        </button>
        {loading && <span className="map-route-status">Loading road route…</span>}
        {!loading && routeError && (
          <span className="map-route-status warn">Some segments unavailable — showing best effort path</span>
        )}
        {!loading && displayPath.length > 1 && (
          <span className="map-route-hint">
            <CarFront size={13} /> Click the red route or a pin to move your vehicle
          </span>
        )}
      </div>
      <div className="map-legend"><span className="legend-road" /> Road-mapped route (OSRM)</div>
    </div>
  );
}
