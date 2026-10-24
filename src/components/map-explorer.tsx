"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { StadiumMap, type MapStadium, type TileConfig } from "./stadium-map";
import { mapDetailHref } from "@/lib/map-navigation";

export function MapExplorer({ stadiums, tiles, selectedSlug, panelKey, title, children }: {
  stadiums: MapStadium[]; tiles: TileConfig | null; selectedSlug: string | null;
  panelKey: string; title: string | null; children: ReactNode;
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

  return <div className="explorer">
    <header className="explorer-heading"><p className="eyebrow">Elche Away · Un archivo personal</p><h1>Donde tú vayas.</h1><p>Una chincheta, muchas historias.</p></header>
    <div className="explorer-stage" aria-busy={pending}>
      {mapData.tiles ? <StadiumMap stadiums={mapData.stadiums} tiles={mapData.tiles} explore selectedSlug={selectedSlug} onStadiumSelect={selectStadium} /> : <p className="explorer-unavailable" role="status">El mapa no está disponible. Puedes seguir explorando el archivo desde los paneles.</p>}
      <Link ref={opener} className="explorer-open" href="/?view=stadiums" scroll={false}>Explorar estadios</Link>
      {pending && <p className="explorer-pending" role="status">Abriendo estadio…</p>}
      {title && <section className="explorer-panel" data-expanded={expanded} aria-labelledby="explorer-panel-title">
        <div className="explorer-panel-bar"><button type="button" className="explorer-expand" aria-expanded={expanded} aria-controls="explorer-panel-content" onClick={() => setExpanded(!expanded)}>{expanded ? "Reducir panel" : "Ampliar panel"}</button><Link href="/" scroll={false} className="explorer-close" aria-label="Cerrar panel y volver al mapa">Cerrar ×</Link></div>
        <div className="explorer-panel-content" id="explorer-panel-content" ref={content}><h2 id="explorer-panel-title" ref={heading} tabIndex={-1}>{title}</h2>{children}</div>
      </section>}
    </div>
    <p className="explorer-help">Selecciona un estadio o abre Viajes, Estadios o Resumen. Escape cierra el panel.</p>
    <noscript><p>El mapa interactivo necesita JavaScript. Los enlaces y el contenido del archivo siguen disponibles.</p><style>{`.explorer-panel { position: static; width: 100%; max-height: none; height: auto; } .explorer-stage { height: auto; min-height: 420px; } .explorer-panel-content { overflow: visible; } .explorer-panel-bar button { display: none; }`}</style></noscript>
  </div>;
}
