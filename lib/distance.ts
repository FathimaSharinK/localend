/**
 * Distance Calculation Utilities using Haversine formula
 * for Hyperlocal Neighborhood Filtering
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Fallback coordinate lookup for known towns/neighborhoods
 * to ensure seamless distance calculation even if older requests
 * only stored text locations.
 */
const KNOWN_COORDINATES_MAP: Record<string, Coordinates> = {
  perinthalmanna: { lat: 10.9760, lng: 76.2254 },
  perinthalamanna: { lat: 10.9760, lng: 76.2254 },
  angadipuram: { lat: 10.9847, lng: 76.2086 },
  angadippuram: { lat: 10.9847, lng: 76.2086 },
  tirurkad: { lat: 11.0182, lng: 76.1963 },
  tiroorkad: { lat: 11.0182, lng: 76.1963 },
  thirurkkad: { lat: 11.0182, lng: 76.1963 },
  malappuram: { lat: 11.0510, lng: 76.0711 },
  manjeri: { lat: 11.1215, lng: 76.1212 },
  kottakkal: { lat: 11.0006, lng: 75.9998 },
  pattambi: { lat: 10.8066, lng: 76.1788 },
  valanchery: { lat: 10.8877, lng: 76.0717 },
  wandoor: { lat: 11.1947, lng: 76.2346 },
  tirur: { lat: 10.9152, lng: 75.9238 },
  kozhikode: { lat: 11.2588, lng: 75.7804 },
  calicut: { lat: 11.2588, lng: 75.7804 },
  palakkad: { lat: 10.7867, lng: 76.6548 },
  thrissur: { lat: 10.5276, lng: 76.2144 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  ernakulam: { lat: 9.9816, lng: 76.2999 },
};

/**
 * Resolves coordinates from given coordinates object or by matching text
 */
export function resolveCoordinates(
  explicitCoords?: Coordinates | null,
  locationText?: string
): Coordinates | null {
  if (
    explicitCoords &&
    typeof explicitCoords.lat === 'number' &&
    typeof explicitCoords.lng === 'number' &&
    !isNaN(explicitCoords.lat) &&
    !isNaN(explicitCoords.lng)
  ) {
    return explicitCoords;
  }

  if (locationText) {
    const cleanText = locationText.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    for (const [name, coords] of Object.entries(KNOWN_COORDINATES_MAP)) {
      if (cleanText.includes(name)) {
        return coords;
      }
    }
  }

  return null;
}

/**
 * Calculates the great-circle distance between two geographic coordinates in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Gets distance between a request and current user coordinates
 */
export function getRequestDistance(
  requestCoords?: Coordinates | null,
  userCoords?: Coordinates | null,
  requestLocationText?: string,
  userLocationText?: string
): number | null {
  const resolvedReqCoords = resolveCoordinates(requestCoords, requestLocationText);
  const resolvedUserCoords = resolveCoordinates(userCoords, userLocationText);

  if (!resolvedReqCoords || !resolvedUserCoords) {
    return null;
  }

  return calculateDistance(
    resolvedUserCoords.lat,
    resolvedUserCoords.lng,
    resolvedReqCoords.lat,
    resolvedReqCoords.lng
  );
}

/**
 * Formats a distance in kilometers into a clean, human-readable string
 */
export function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return null;
  }

  if (distanceKm < 0.1) {
    return '< 100 m away';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

export const DISTANCE_FILTERS = [
  { label: 'All Distances', value: 'all', maxKm: null },
  { label: '< 5 km', value: '5', maxKm: 5 },
  { label: '< 10 km', value: '10', maxKm: 10 },
  { label: '< 25 km', value: '25', maxKm: 25 },
  { label: '< 50 km', value: '50', maxKm: 50 },
] as const;
