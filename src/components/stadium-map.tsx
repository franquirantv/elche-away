"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapConfig } from "@/lib/map-config";
import { createStadiumBadge } from "@/lib/stadium-badge";
import { MapIcon } from "./map-icon";

export type MapStadium = { slug: string; name: string; location: string; latitude: number | null; longitude: number | null; visits: number; isSpecial: boolean; crestPath: string | null; crestClubName: string | null };
const initialBounds: [[number, number], [number, number]] = [[35.7, -9.6], [43.9, 3.4]];

export function StadiumMap({ stadiums, config, selectedSlug, onStadiumSelect, onReset }: {
  stadiums: MapStadium[]; config: MapConfig; selectedSlug: string | null; onStadiumSelect: (slug: string) => void; onReset: () => void;
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
    function removeMap() {
      try { instance?.remove(); } catch {
        // A failed WebGL constructor can leave the bridge without a renderer to remove.
        container.current?.replaceChildren();
      } finally { instance = undefined; }
    }
    async function initialize() {
      try {
        const [L, { maplibreGL }] = await Promise.all([import("leaflet"), import("@maplibre/maplibre-gl-leaflet")]);
        if (cancelled || !container.current) return;
        instance = L.map(container.current, { scrollWheelZoom: true, zoomControl: false, attributionControl: false, maxZoom: config.maxZoom });
        const layer = maplibreGL({ style: config.styleUrl, interactive: false });
        for (const stadium of stadiums) {
          if (stadium.latitude === null || stadium.longitude === null) continue;
          const marker = L.marker([stadium.latitude, stadium.longitude], {
            title: `${stadium.name} · ${stadium.visits ? `Visitado · ${stadium.visits} visitas` : "Pendiente de visitar"}` + (stadium.crestClubName ? ` · Rival de las visitas: ${stadium.crestClubName}` : ""),
            alt: stadium.name,
            icon: L.divIcon({ className: `stadium-marker ${stadium.visits ? "is-visited" : "is-pending"}`, html: createStadiumBadge(stadium.crestPath, stadium.visits), iconSize: [48, 56], iconAnchor: [24, 56] }),
          }).addTo(instance);
          marker.on("click", () => selectCallback.current(stadium.slug));
          marker.getElement()?.setAttribute("aria-label", `${stadium.name}. ${stadium.visits ? `Visitado, ${stadium.visits} visitas` : "Pendiente de visitar"}${stadium.crestClubName ? `. Rival de las visitas: ${stadium.crestClubName}` : ""}`);
          marker.getElement()?.setAttribute("aria-pressed", "false");
          currentMarkers.set(stadium.slug, marker);
        }
        instance.fitBounds(initialBounds, { padding: [36, 72], animate: false });
        layer.addTo(instance);
        const renderer = layer.getMaplibreMap();
        renderer.on("error", () => { if (!cancelled) setMessage("No se ha podido cargar parte del mapa. Puedes seguir consultando los viajes y estadios con los controles del archivo."); });
        const canvas = renderer.getCanvas();
        canvas.setAttribute("aria-hidden", "true");
        canvas.tabIndex = -1;
        setMap(instance);
        setMessage("");
      } catch {
        if (!cancelled) {
          setMessage("El mapa no está disponible. Puedes seguir consultando los viajes y estadios con los controles del archivo.");
          setMap(null);
        }
        currentMarkers.clear();
        removeMap();
      }
    }
    void initialize();
    return () => { cancelled = true; currentMarkers.clear(); removeMap(); };
  }, [stadiums, config]);

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
      const zoom = Math.min(10, config.maxZoom);
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const offset: [number, number] = mobile ? [0, map.getSize().y * .21] : [210, 0];
      map.stop();
      map.setView(map.unproject(map.project(marker.getLatLng(), zoom).add(offset), zoom), zoom, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
    centerSelection();
    map.on("resize", centerSelection);
    return () => { map.off("resize", centerSelection); };
  }, [map, selectedSlug, config.maxZoom]);

  function resetView() {
    if (!map) return;
    map.stop();
    map.fitBounds(initialBounds, { padding: [36, 72], animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    onReset();
  }

  return <section aria-label="Mapa interactivo" className="map-section">
    <div ref={container} className="stadium-map" aria-label="Colección de estadios" aria-describedby="map-help" />
    <p id="map-help" className="sr-only">Arrastra el mapa para explorar. Usa la rueda, dos dedos o los controles para ampliar. También puedes desplazarte con las flechas del teclado al enfocar el mapa.</p>
    <div className="map-controls" role="group" aria-label="Controles del mapa">
      <button type="button" disabled={!map} onClick={() => map?.zoomIn()} aria-label="Acercar" title="Acercar">+</button>
      <button type="button" disabled={!map} onClick={() => map?.zoomOut()} aria-label="Alejar" title="Alejar">−</button>
      <button type="button" disabled={!map} onClick={resetView} aria-label="Volver a la vista inicial de la península ibérica" title="Vista inicial de la península"><MapIcon name="locate" /></button>
    </div>
    <p className="map-attribution"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></p>
    <p role="status" className="map-status">{message}</p>
  </section>;
}
