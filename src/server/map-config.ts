import "server-only";
import type { TileConfig } from "@/components/stadium-map";

// Public provider configuration, read at request time; never pass credentials.
export function mapTileConfig(): TileConfig | null {
  const url = process.env.MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attributionText = process.env.MAP_TILE_ATTRIBUTION_TEXT || "OpenStreetMap contributors";
  const attributionUrl = process.env.MAP_TILE_ATTRIBUTION_URL || "https://www.openstreetmap.org/copyright";
  const maxZoom = Number(process.env.MAP_TILE_MAX_ZOOM || "19");
  try {
    const parsed = new URL(url);
    const attribution = new URL(attributionUrl);
    if (parsed.protocol !== "https:" || attribution.protocol !== "https:" || parsed.username || parsed.password || !["{z}", "{x}", "{y}"].every((part) => url.includes(part)) || !Number.isInteger(maxZoom) || maxZoom < 1 || maxZoom > 19) return null;
    return { url, attributionText, attributionUrl, maxZoom };
  } catch { return null; }
}
