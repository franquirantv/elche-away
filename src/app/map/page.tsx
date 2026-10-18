import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StadiumMap, type MapStadium } from "@/components/stadium-map";
import { getVisitedStadiums } from "@/db/public-archive";
import { formatLocation } from "@/lib/geography";
import { mapTileConfig } from "@/server/map-config";

export const metadata: Metadata = { title: "Mapa" };

export default async function MapPage() {
  const stadiums = await getVisitedStadiums();
  if (!stadiums.length) return <EmptyState eyebrow="03 / Las chinchetas" title="Mapa" description="Del mapa de corcho a los lugares donde seguimos al Elche." message="Todavía no hay estadios visitados publicados." />;
  const markers: MapStadium[] = stadiums.flatMap((stadium) => stadium.latitude === null || stadium.longitude === null ? [] : [{ slug: stadium.slug, name: stadium.name, latitude: stadium.latitude, longitude: stadium.longitude, visits: stadium.visits, isSpecial: stadium.isSpecial }]);
  const tiles = mapTileConfig();
  return <div className="page-content">
    <header className="page-heading"><p className="eyebrow">03 / Las chinchetas</p><h1>Mapa</h1><p className="lead">Del mapa de corcho a los lugares donde seguimos al Elche.</p></header>
    <p className="map-coverage">Estadios con coordenadas: {markers.length} de {stadiums.length}. Sin coordenadas: {stadiums.length - markers.length}.</p>
    <a href="#stadium-list" className="inline-link">Ir a la lista de estadios</a>
    {markers.length > 0 && tiles ? <StadiumMap stadiums={markers} tiles={tiles} /> : <p className="map-section">{markers.length ? "El mapa no está disponible." : "Todavía no hay coordenadas para mostrar marcadores."} Puedes usar la lista de estadios.</p>}
    <section id="stadium-list" aria-labelledby="stadium-list-title">
      <h2 id="stadium-list-title" className="group-title">Estadios visitados</h2>
      <ul className="stadium-grid">{stadiums.map((stadium) => <li key={stadium.slug} className="trip-card">
        <span className="eyebrow">{stadium.visits} {stadium.visits === 1 ? "visita" : "visitas"}</span>
        <h3><Link href={`/stadiums/${stadium.slug}`}>{stadium.name}</Link></h3>
        <p>{formatLocation(stadium.city, stadium.provinceCode)}</p>
        {stadium.isSpecial && <p className="special-label">Viaje especial</p>}
        {(stadium.latitude === null || stadium.longitude === null) && <p>Sin coordenadas</p>}
      </li>)}</ul>
    </section>
  </div>;
}
