"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapStadium = { slug: string; name: string; latitude: number; longitude: number; visits: number; isSpecial: boolean };
export type TileConfig = { url: string; attributionText: string; attributionUrl: string; maxZoom: number };

export function StadiumMap({ stadiums, tiles }: { stadiums: MapStadium[]; tiles: TileConfig }) {
  const container = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!active || !container.current) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    async function initialize() {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;
        map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: false, maxZoom: tiles.maxZoom });
        L.control.zoom({ zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(map);
        const layer = L.tileLayer(tiles.url, {
          maxZoom: tiles.maxZoom, keepBuffer: 0, updateWhenIdle: true,
          updateWhenZooming: false, referrerPolicy: "strict-origin-when-cross-origin",
        });
        layer.on("tileerror", () => {
          if (!cancelled) setMessage("No se ha podido cargar parte del mapa. Puedes seguir usando la lista de estadios.");
        });
        const points = stadiums.map((stadium) => {
          const point = L.latLng(stadium.latitude, stadium.longitude);
          const popup = document.createElement("div");
          const link = document.createElement("a");
          link.href = `/stadiums/${stadium.slug}`;
          link.textContent = stadium.name;
          const details = document.createElement("p");
          details.textContent = `${stadium.visits} ${stadium.visits === 1 ? "visita" : "visitas"}${stadium.isSpecial ? " · Viaje especial" : ""}`;
          popup.append(link, details);
          L.marker(point, {
            title: stadium.name, alt: stadium.name,
            icon: L.divIcon({ className: "stadium-marker", html: `<span aria-hidden="true">${stadium.isSpecial ? "★" : "●"}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
          }).bindPopup(popup).addTo(map!);
          return point;
        });
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 12 });
        layer.addTo(map);
      } catch {
        if (!cancelled) setMessage("El mapa no está disponible. Puedes seguir usando la lista de estadios.");
        map?.remove();
        map = undefined;
      }
    }
    void initialize();
    return () => { cancelled = true; map?.remove(); };
  }, [active, stadiums, tiles]);

  return <section aria-label="Mapa interactivo" className="map-section">
    <p id="map-help">Activa el mapa para moverlo y ampliar con dos dedos o con los botones. Desactívalo para seguir desplazándote por la página.</p>
    <button type="button" className="button-link" aria-pressed={active} onClick={() => { setMessage(""); setActive(!active); }}>{active ? "Desactivar mapa" : "Activar mapa"}</button>
    {active && <div ref={container} className="stadium-map" aria-label="Estadios visitados" aria-describedby="map-help" />}
    <p className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>{tiles.attributionUrl !== "https://www.openstreetmap.org/copyright" && <> · <a href={tiles.attributionUrl}>{tiles.attributionText}</a></>}</p>
    <p role="status">{message}</p>
  </section>;
}
