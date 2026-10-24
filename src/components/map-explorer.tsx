"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { StadiumMap, type MapStadium, type TileConfig } from "./stadium-map";
import { mapDetailHref } from "@/lib/map-navigation";

export function MapExplorer({ stadiums, tiles, selectedSlug, panelKey, title, information, children }: {
  stadiums: MapStadium[]; tiles: TileConfig | null; selectedSlug: string | null;
  panelKey: string; title: string | null; information: ReactNode; children: ReactNode;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLAnchorElement>(null);
  const previousKey = useRef(panelKey);
  // Query navigation streams new server content, but unchanged geographic data
  // must not recreate Leaflet or discard the user's viewport.
  const serialized = JSON.stringify({ stadiums, tiles });
  const mapData = useMemo(() => JSON.parse(serialized) as { stadiums: MapStadium[]; tiles: TileConfig | null }, [serialized]);
  const selectStadium = useCallback((slug: string) => {
    startTransition(() => router.push(mapDetailHref("stadium", slug), { scroll: false }));
  }, [router]);

  useEffect(() => {
    if (previousKey.current === panelKey) return;
    previousKey.current = panelKey;
    if (title) {
      heading.current?.focus({ preventScroll: true });
      content.current?.scrollTo({ top: 0 });
    } else opener.current?.focus({ preventScroll: true });
  }, [panelKey, title]);

  useEffect(() => {
    if (!title) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        router.push("/", { scroll: false });
      }
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [router, title]);

  const reset = () => {
    setExpanded(false);
    startTransition(() => router.push("/", { scroll: false }));
  };

  return <div className="explorer">
    <div className="explorer-stage" aria-busy={pending}>
      {mapData.tiles ? <StadiumMap stadiums={mapData.stadiums} tiles={mapData.tiles} selectedSlug={selectedSlug} onStadiumSelect={selectStadium} onReset={reset} /> : <p className="explorer-unavailable" role="status">El mapa no está disponible. Puedes seguir explorando el archivo desde los paneles.</p>}
      <div className="map-identity"><span className="brand-symbol" aria-hidden="true">ea.</span><div><h1>Elche Away</h1><p>Donde tú vayas.</p></div></div>
      <div className="map-actions" role="group" aria-label="Explorar el archivo">
        <Link className="map-action" href="/?view=trips" scroll={false} aria-current={panelKey === "trips" || panelKey.startsWith("trip:") ? "page" : undefined}><span aria-hidden="true">≡</span>Viajes</Link>
        <Link ref={opener} className="explorer-open map-action" href="/?view=stadiums" scroll={false} aria-current={panelKey === "stadiums" || panelKey.startsWith("stadium:") ? "page" : undefined}><span aria-hidden="true">⌖</span>Estadios</Link>
        <Link className="map-action" href="/?view=summary" scroll={false} aria-current={panelKey === "summary" ? "page" : undefined}><span aria-hidden="true">▥</span>Resumen</Link>
      </div>
      <details className="explorer-info"><summary>Archivo</summary><div>
        <p>Archivo personal de un aficionado. Sin vinculación oficial con el Elche CF.</p>
        {information}
        <p>Selecciona un estadio o abre Viajes, Estadios o Resumen. Escape cierra el panel.</p>
        <Link href="/admin" prefetch={false} className="text-link">Acceso del propietario</Link>
        <noscript><p>El mapa interactivo necesita JavaScript. Puedes seguir consultando los paneles mediante sus enlaces.</p></noscript>
      </div></details>
      {pending && <p className="explorer-pending" role="status">Cargando archivo…</p>}
      {title && <section className="explorer-panel" data-expanded={expanded} aria-labelledby="explorer-panel-title">
        <div className="explorer-panel-bar"><button type="button" className="explorer-expand" aria-expanded={expanded} aria-controls="explorer-panel-content" onClick={() => setExpanded(!expanded)}>{expanded ? "Reducir panel" : "Ampliar panel"}</button><Link href="/" scroll={false} className="explorer-close" aria-label="Cerrar panel y volver al mapa">Cerrar ×</Link></div>
        <div className="explorer-panel-content" id="explorer-panel-content" ref={content}><h2 id="explorer-panel-title" ref={heading} tabIndex={-1}>{title}</h2>{children}</div>
      </section>}
    </div>
    <noscript><style>{`.explorer-panel { height: calc(100dvh - 180px); max-height: calc(100dvh - 180px); } .explorer-panel-bar button, .map-controls { display: none; }`}</style></noscript>
  </div>;
}
