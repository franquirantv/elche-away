type ScreenPoint = { x: number; y: number };

// Marker icons occupy 48 × 56 CSS pixels, anchored at their bottom centre.
export function markersOverlap(first: ScreenPoint, second: ScreenPoint): boolean {
  return Math.abs(first.x - second.x) < 48 && Math.abs(first.y - second.y) < 56;
}
