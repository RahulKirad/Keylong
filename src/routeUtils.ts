export type LatLng = [number, number];

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function fetchSegment(a: LatLng, b: LatLng): Promise<LatLng[]> {
  const url = `${OSRM}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('routing failed');
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords?.length) throw new Error('no geometry');
    return coords.map(([lng, lat]) => [lat, lng] as LatLng);
  } catch {
    return [a, b];
  }
}

/** Build a continuous road-following path through waypoints (OSRM driving). */
export async function fetchRoadRoute(waypoints: LatLng[]): Promise<LatLng[]> {
  if (waypoints.length < 2) return waypoints;
  const merged: LatLng[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = await fetchSegment(waypoints[i], waypoints[i + 1]);
    if (!merged.length) merged.push(...seg);
    else merged.push(...seg.slice(1));
  }
  return merged;
}

function pathLength(path: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]);
  return d;
}

/** Position at fraction t ∈ [0,1] along path by distance. */
export function pointAlongPath(path: LatLng[], t: number): LatLng {
  if (!path.length) return [0, 0];
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];
  const total = pathLength(path);
  if (total === 0) return path[0];
  const target = total * t;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineKm(path[i - 1], path[i]);
    if (walked + seg >= target) {
      const f = seg > 0 ? (target - walked) / seg : 0;
      const lat = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f;
      const lng = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f;
      return [lat, lng];
    }
    walked += seg;
  }
  return path[path.length - 1];
}

export function bearingAlongPath(path: LatLng[], t: number): number {
  const p = pointAlongPath(path, Math.min(t, 0.999));
  const p2 = pointAlongPath(path, Math.min(t + 0.002, 1));
  const dy = p2[0] - p[0];
  const dx = p2[1] - p[1];
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}
