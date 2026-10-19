"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { createStadiumBadge } from "@/lib/stadium-badge";

export type MapStadium = { slug: string; name: string; location: string; latitude: number | null; longitude: number | null; visits: number; isSpecial: boolean; crestPath: string | null; crestClubName: string | null };
export type TileConfig = { url: string; attributionText: string; attributionUrl: string; maxZoom: number };

export function StadiumMap({ stadiums, tiles }: { stadiums: MapStadium[]; tiles: TileConfig }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const cards = useRef(new Map<string, HTMLLIElement>());
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(true);
  const [message, setMessage] = useState("Cargando mapa…");

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    const currentMarkers = markers.current;
    async function initialize() {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;
        map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: false, maxZoom: tiles.maxZoom });
        mapRef.current = map;
        L.control.zoom({ zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(map);
        const layer = L.tileLayer(tiles.url, {
          maxZoom: tiles.maxZoom, keepBuffer: 0, updateWhenIdle: true,
          updateWhenZooming: false, referrerPolicy: "strict-origin-when-cross-origin",
        });
        layer.on("tileerror", () => {
          if (!cancelled) setMessage("No se ha podido cargar parte del mapa. Puedes seguir usando las tarjetas y la lista de estadios.");
        });
        for (const stadium of stadiums) {
          if (stadium.latitude === null || stadium.longitude === null) continue;
          const popup = document.createElement("div");
          const link = document.createElement("a");
          link.href = `/stadiums/${stadium.slug}`;
          link.textContent = stadium.name;
          const location = document.createElement("p");
          location.textContent = stadium.location;
          const details = document.createElement("p");
          details.textContent = `${stadium.visits} ${stadium.visits === 1 ? "visita" : "visitas"}${stadium.isSpecial ? " · Viaje especial" : ""}`;
          popup.append(link, location, details);
          const marker = L.marker([stadium.latitude, stadium.longitude], {
            title: stadium.crestClubName ? `${stadium.name} · Rival de las visitas: ${stadium.crestClubName}` : stadium.name,
            alt: stadium.name,
            icon: L.divIcon({ className: "stadium-marker", html: createStadiumBadge(stadium.crestPath), iconSize: [48, 56], iconAnchor: [24, 56], popupAnchor: [0, -48] }),
          }).bindPopup(popup, { maxWidth: 260, autoPanPaddingTopLeft: [24, 60], autoPanPaddingBottomRight: [24, 230] }).addTo(map);
          marker.on("popupopen", () => {
            if (cancelled) return;
            setSelected(stadium.slug);
            for (const [slug, item] of currentMarkers) {
              const active = slug === stadium.slug;
              item.getElement()?.classList.toggle("is-selected", active);
              item.getElement()?.setAttribute("aria-pressed", String(active));
              item.setZIndexOffset(active ? 1000 : 0);
            }
            const card = cards.current.get(stadium.slug);
            const track = card?.parentElement;
            // Scroll only the horizontal track, never the page or the map viewport.
            if (card && track) track.scrollTo({ left: card.offsetLeft - track.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          });
          marker.getElement()?.setAttribute("aria-label", stadium.crestClubName ? `${stadium.name}. Rival de las visitas: ${stadium.crestClubName}` : stadium.name);
          marker.getElement()?.setAttribute("aria-pressed", "false");
          currentMarkers.set(stadium.slug, marker);
        }
        // Fixed geographic bounds, independent of attendance and available coordinates.
        map.fitBounds([[35.7, -9.6], [43.9, 3.4]], { paddingTopLeft: [20, 20], paddingBottomRight: [20, 225], animate: false });
        layer.addTo(map);
        setReady(true);
        setMessage("");
      } catch {
        if (!cancelled) setMessage("El mapa no está disponible. Puedes seguir usando las tarjetas y la lista de estadios.");
        map?.remove();
        map = undefined;
        mapRef.current = null;
      }
    }
    void initialize();
    return () => { cancelled = true; currentMarkers.clear(); map?.remove(); mapRef.current = null; };
  }, [stadiums, tiles]);

  function selectStadium(stadium: MapStadium) {
    const map = mapRef.current;
    const marker = markers.current.get(stadium.slug);
    if (!map || !marker) return;
    setSelected(stadium.slug);
    const point = marker.getLatLng();
    const zoom = Math.min(12, tiles.maxZoom);
    // Keep the selected pin above the cards rather than hidden behind them.
    const center = map.unproject(map.project(point, zoom).add([0, 10]), zoom);
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.stop();
    const popup = marker.getPopup();
    if (popup) popup.options.autoPan = false;
    marker.openPopup();
    if (popup) popup.options.autoPan = true;
    map.setView(center, zoom, { animate, duration: 0.7 });
  }

  function toggleInteraction() {
    const map = mapRef.current;
    if (!map) return;
    const enabled = !interactive;
    for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.keyboard]) {
      if (enabled) handler.enable(); else handler.disable();
    }
    setInteractive(enabled);
  }

  return <section aria-label="Mapa interactivo" className="map-section">
    <div className="map-toolbar"><p id="map-help">Explora el mapa o elige un estadio. Usa dos dedos o los botones para ampliar.</p><button type="button" className="map-toggle" disabled={!ready} aria-pressed={interactive} onClick={toggleInteraction}>{interactive ? "Pausar interacción" : "Reanudar interacción"}</button></div>
    <div className="map-stage">
      <div ref={container} className="stadium-map" aria-label="Estadios visitados" aria-describedby="map-help" />
      <ul className="map-carousel" aria-label="Seleccionar estadio visitado">{stadiums.map((stadium) => <li className="map-card" data-selected={selected === stadium.slug} key={stadium.slug} ref={(node) => { if (node) cards.current.set(stadium.slug, node); else cards.current.delete(stadium.slug); }}>
        <button type="button" className="map-card-select" disabled={!ready || stadium.latitude === null || stadium.longitude === null} aria-pressed={selected === stadium.slug} onClick={() => selectStadium(stadium)}><span className="map-card-name">{stadium.name}</span><span>{stadium.location}</span><span>{stadium.visits} {stadium.visits === 1 ? "visita" : "visitas"}{stadium.isSpecial ? " · Viaje especial" : ""}</span>{(stadium.latitude === null || stadium.longitude === null) && <span>Sin coordenadas</span>}</button>
        <a className="map-card-history" href={`/stadiums/${stadium.slug}`}>Ver historial del estadio</a>
      </li>)}</ul>
    <p className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>{tiles.attributionUrl !== "https://www.openstreetmap.org/copyright" && <> · <a href={tiles.attributionUrl}>{tiles.attributionText}</a></>}</p>
    </div>
    <p role="status">{message}</p>
  </section>;
}
