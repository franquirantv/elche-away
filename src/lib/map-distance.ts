export const mapOrigin: [number, number] = [38.25928802298828, -0.7093247209572442];

// Mean Earth radius, in kilometres. Geographic distance, never a road itinerary.
export function distanceFromOrigin(latitude: number, longitude: number): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (latitude - mapOrigin[0]) * radians;
  const deltaLongitude = (longitude - mapOrigin[1]) * radians;
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(mapOrigin[0] * radians) * Math.cos(latitude * radians) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function distanceLabel(latitude: number, longitude: number): string {
  return `≈ ${Math.round(distanceFromOrigin(latitude, longitude)).toLocaleString("es-ES")} km desde Elche · línea recta · solo ida`;
}
