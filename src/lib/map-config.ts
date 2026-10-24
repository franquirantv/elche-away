export type MapConfig = { styleUrl: string; maxZoom: number };

export function resolveMapConfig(environment: Readonly<Record<string, string | undefined>>): MapConfig | null {
  const styleUrl = environment.MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
  const maxZoom = Number(environment.MAP_MAX_ZOOM || "19");
  try {
    const style = new URL(styleUrl);
    // Public style documents only: no credentials, tokens or fragments sent to the browser.
    if (style.protocol !== "https:" || style.username || style.password || style.search || style.hash || !Number.isInteger(maxZoom) || maxZoom < 1 || maxZoom > 19) return null;
    return { styleUrl, maxZoom };
  } catch { return null; }
}
