import type { ReactNode } from "react";

type MapIconName = "plane" | "folder" | "stadium" | "locate";

const shapes: Record<MapIconName, ReactNode> = {
  plane: <path d="M17.8 8.6 21 5.4a2.1 2.1 0 0 0-3-3l-3.2 3.2L5 3 3 5l8 4-5 5-3-1-2 2 5 3 3 5 2-2-1-3 5-5 4 8 2-2Z" />,
  folder: <><path d="M8 7V3h11v6M12 6h4M12 9h4" /><path d="M3 7h5l2 3h11l-2 10H3L1 7h2ZM3 10V7M7 14h9" /></>,
  stadium: <><ellipse cx="12" cy="7" rx="9" ry="4" /><path d="M3 7v9c0 2.2 4 4 9 4s9-1.8 9-4V7M7 11v7m5-6v8m5-9v7M6 7c2-2 10-2 12 0" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
};

export function MapIcon({ name }: { name: MapIconName }) {
  return <svg className="map-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
