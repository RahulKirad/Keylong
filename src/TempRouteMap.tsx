import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Minus, Plus } from 'lucide-react';
import { PLACE_TEMP_PROFILES } from './temperatureData';
import { TRIP_MAP_TILES } from './mapTiles';
import { getPlaces } from './itineraryStore';

const ROUTE_ORDER = ['shimla', 'narkanda', 'sangla', 'kalpa', 'nako', 'tabo', 'kaza', 'langza', 'kufri'];

type TempRouteMapProps = {
  selectedPlaceId: string;
  onSelectPlace: (placeId: string) => void;
  online?: boolean;
  wide?: boolean;
};

function pinIcon(active: boolean, label: string) {
  return L.divIcon({
    className: 'wx-leaflet-pin',
    html: `<div class="wx-leaflet-pin-inner${active ? ' on' : ''}"><span class="wx-leaflet-dot"></span><span class="wx-leaflet-label">${label}</span></div>`,
    iconSize: [90, 36],
    iconAnchor: [10, 10],
  });
}

function FitRoute({ points, selected }: { points: [number, number][]; selected: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 8 });
    }
  }, [map, points]);

  useEffect(() => {
    if (!selected) return;
    map.flyTo(selected, Math.max(map.getZoom(), 9), { duration: 0.65 });
  }, [map, selected]);

  return null;
}

function MapChrome() {
  const map = useMap();
  useEffect(() => {
    const paint = () => map.invalidateSize();
    const t = window.setTimeout(paint, 80);
    window.addEventListener('resize', paint);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', paint);
    };
  }, [map]);

  return (
    <div className="wx-map-controls">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <Plus size={14} />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label="Reset view"
        onClick={() => {
          const pts = ROUTE_ORDER.map((id) => PLACE_TEMP_PROFILES.find((p) => p.placeId === id))
            .filter(Boolean)
            .map((p) => [p!.lat, p!.lng] as [number, number]);
          if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 8 });
        }}
      >
        <Layers size={14} />
      </button>
    </div>
  );
}

export default function TempRouteMap({ selectedPlaceId, onSelectPlace, online = true, wide }: TempRouteMapProps) {
  const stops = useMemo(
    () =>
      ROUTE_ORDER.map((id) => PLACE_TEMP_PROFILES.find((p) => p.placeId === id)).filter(
        Boolean,
      ) as typeof PLACE_TEMP_PROFILES,
    [],
  );

  const points = useMemo(() => stops.map((p) => [p.lat, p.lng] as [number, number]), [stops]);
  const selected = stops.find((p) => p.placeId === selectedPlaceId);
  const selectedLatLng = selected ? ([selected.lat, selected.lng] as [number, number]) : null;
  const tripPlaces = useMemo(() => getPlaces(), [selectedPlaceId]);

  return (
    <div className={`wx-dark-map${wide ? ' wide' : ''}`}>
      <MapContainer
        center={[31.9, 78.1]}
        zoom={7}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        className="wx-leaflet"
      >
        {/* Same OSM tiles as the trip planner map, rendered in dark mode via CSS. */}
        <TileLayer
          url={TRIP_MAP_TILES.url}
          attribution={TRIP_MAP_TILES.attribution}
          maxZoom={TRIP_MAP_TILES.maxZoom}
          className="wx-basemap-tiles"
        />
        <FitRoute points={points} selected={selectedLatLng} />
        {points.length > 1 && (
          <Polyline
            positions={points}
            pathOptions={{
              color: '#6b7280',
              weight: 3,
              opacity: 0.85,
              dashArray: '6 8',
              lineCap: 'round',
            }}
          />
        )}
        {points.length > 1 && (
          <Polyline
            positions={points}
            pathOptions={{
              color: '#9ec9f0',
              weight: 1.5,
              opacity: 0.35,
            }}
          />
        )}
        {stops.map((p) => {
          const active = p.placeId === selectedPlaceId;
          const tripPlace = tripPlaces.find((place) => place.id === p.placeId);
          const stayName = tripPlace?.stayName?.trim();
          const stayType = tripPlace?.stayType?.trim();
          const stay = stayName ? (stayType ? `${stayType}: ${stayName}` : stayName) : null;
          return (
            <Marker
              key={p.placeId}
              position={[p.lat, p.lng]}
              icon={pinIcon(active, p.name.split(' / ')[0])}
              zIndexOffset={active ? 500 : 0}
              eventHandlers={{
                click: () => onSelectPlace(p.placeId),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                <div className="map-pin-tooltip dark">
                  <strong>{p.name}</strong>
                  <span>
                    {p.region} · {p.alt}
                  </span>
                  {stay ? <span className="map-pin-stay">{stay}</span> : <span className="map-pin-stay muted">Stay not set yet</span>}
                </div>
              </Tooltip>
              <Popup className="wx-leaflet-popup">
                <strong>{p.name}</strong>
                <br />
                {p.region} · {p.alt}
                <br />
                {stay ? (
                  <>
                    Stay: {stay}
                    <br />
                  </>
                ) : null}
                <button type="button" onClick={() => onSelectPlace(p.placeId)}>
                  Show temperature
                </button>
              </Popup>
            </Marker>
          );
        })}
        <MapChrome />
      </MapContainer>
      {!online && (
        <div className="wx-map-offline-hint">
          Map tiles need network once; route pins and temperatures stay available offline.
        </div>
      )}
    </div>
  );
}
