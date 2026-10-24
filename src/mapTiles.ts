/**
 * Shared Leaflet basemap — same OpenStreetMap tiles used by the trip planner map.
 * Temperature page applies a CSS dark filter on top of these tiles (no third-party key).
 */
export const TRIP_MAP_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const;
