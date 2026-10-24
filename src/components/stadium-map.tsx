"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { createStadiumBadge } from "@/lib/stadium-badge";
import { MapIcon } from "./map-icon";

export type MapStadium = { slug: string; name: string; location: string; latitude: number | null; longitude: number | null; visits: number; isSpecial: boolean; crestPath: string | null; crestClubName: string | null };
export type TileConfig = { url: string; attributionText: string; attributionUrl: string; maxZoom: number };
const initialBounds: [[number, number], [number, number]] = [[35.7, -9.6], [43.9, 3.4]];

export function StadiumMap({ stadiums, tiles, selectedSlug, onStadiumSelect, onReset }: {
  stadiums: MapStadium[]; tiles: TileConfig; selectedSlug: string | null; onStadiumSelect: (slug: string) => void; onReset: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, Marker>());
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [message, setMessage] = useState("Cargando mapa…");
  const selectCallback = useRef(onStadiumSelect);
  useEffect(() => { selectCallback.current = onStadiumSelect; }, [onStadiumSelect]);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let instance: LeafletMap | undefined;
    const currentMarkers = markers.current;
    async function initialize() {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;
        instance = L.map(container.current, { scrollWheelZoom: true, zoomControl: false, attributionControl: false, maxZoom: tiles.maxZoom });
        const layer = L.tileLayer(tiles.url, { maxZoom: tiles.maxZoom, keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false, referrerPolicy: "strict-origin-when-cross-origin" });
        layer.on("tileerror", () => { if (!cancelled) setMessage("No se ha podido cargar parte del mapa. Puedes seguir consultando los viajes y estadios con los controles del archivo."); });
        for (const stadium of stadiums) {
          if (stadium.latitude === null || stadium.longitude === null) continue;
          const marker = L.marker([stadium.latitude, stadium.longitude], {
            title: stadium.crestClubName ? `${stadium.name} · Rival de las visitas: ${stadium.crestClubName}` : stadium.name,
            alt: stadium.name,
            icon: L.divIcon({ className: "stadium-marker", html: createStadiumBadge(stadium.crestPath), iconSize: [48, 56], iconAnchor: [24, 56] }),
          }).addTo(instance);
          marker.on("click", () => selectCallback.current(stadium.slug));
          marker.getElement()?.setAttribute("aria-label", stadium.crestClubName ? `${stadium.name}. Rival de las visitas: ${stadium.crestClubName}` : stadium.name);
          marker.getElement()?.setAttribute("aria-pressed", "false");
          currentMarkers.set(stadium.slug, marker);
        }
        instance.fitBounds(initialBounds, { padding: [36, 72], animate: false });
        layer.addTo(instance);
        setMap(instance);
        setMessage("");
      } catch {
        if (!cancelled) {
          setMessage("El mapa no está disponible. Puedes seguir consultando los viajes y estadios con los controles del archivo.");
          setMap(null);
        }
        instance?.remove();
      }
    }
    void initialize();
    return () => { cancelled = true; currentMarkers.clear(); instance?.remove(); };
  }, [stadiums, tiles]);

  useEffect(() => {
    if (!map) return;
    for (const [slug, marker] of markers.current) {
      const active = slug === selectedSlug;
      marker.getElement()?.classList.toggle("is-selected", active);
      marker.getElement()?.setAttribute("aria-pressed", String(active));
      marker.setZIndexOffset(active ? 1000 : 0);
    }
    const marker = selectedSlug ? markers.current.get(selectedSlug) : undefined;
    if (!marker) return;
    function centerSelection() {
      if (!map || !marker) return;
      const zoom = Math.min(10, tiles.maxZoom);
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const offset: [number, number] = mobile ? [0, map.getSize().y * .21] : [210, 0];
      map.stop();
      map.setView(map.unproject(map.project(marker.getLatLng(), zoom).add(offset), zoom), zoom, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
    centerSelection();
    map.on("resize", centerSelection);
    return () => { map.off("resize", centerSelection); };
  }, [map, selectedSlug, tiles.maxZoom]);

  function resetView() {
    if (!map) return;
    map.stop();
    map.fitBounds(initialBounds, { padding: [36, 72], animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    onReset();
  }
  function pan(x: number, y: number) { map?.panBy([x, y], { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches }); }

  return <section aria-label="Mapa interactivo" className="map-section">
    <div ref={container} className="stadium-map" aria-label="Estadios visitados" aria-describedby="map-help" />
    <p id="map-help" className="sr-only">Arrastra el mapa para explorar. Usa la rueda, dos dedos o los controles para ampliar. También puedes desplazarte con los botones de dirección.</p>
    <div className="map-controls" role="group" aria-label="Controles del mapa">
      <button type="button" disabled={!map} onClick={() => map?.zoomIn()} aria-label="Acercar" title="Acercar">+</button>
      <button type="button" disabled={!map} onClick={() => map?.zoomOut()} aria-label="Alejar" title="Alejar">−</button>
      <button type="button" disabled={!map} onClick={resetView} aria-label="Volver a la vista inicial de la península ibérica" title="Vista inicial de la península"><MapIcon name="locate" /></button>
      <div className="map-pan" role="group" aria-label="Direcciones del mapa">
        <button type="button" disabled={!map} onClick={() => pan(0, -160)} aria-label="Mover al norte" title="Mover al norte"><MapIcon name="north" /></button>
        <button type="button" disabled={!map} onClick={() => pan(-160, 0)} aria-label="Mover al oeste" title="Mover al oeste"><MapIcon name="west" /></button>
        <button type="button" disabled={!map} onClick={() => pan(160, 0)} aria-label="Mover al este" title="Mover al este"><MapIcon name="east" /></button>
        <button type="button" disabled={!map} onClick={() => pan(0, 160)} aria-label="Mover al sur" title="Mover al sur"><MapIcon name="south" /></button>
      </div>
    </div>
    <p className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>{tiles.attributionUrl !== "https://www.openstreetmap.org/copyright" && <> · <a href={tiles.attributionUrl}>{tiles.attributionText}</a></>}</p>
    <p role="status" className="map-status">{message}</p>
  </section>;
}
