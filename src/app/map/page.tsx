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
  const mapStadiums: MapStadium[] = stadiums.map((stadium) => ({ slug: stadium.slug, name: stadium.name, location: formatLocation(stadium.city, stadium.provinceCode), latitude: stadium.latitude, longitude: stadium.longitude, visits: stadium.visits, isSpecial: stadium.isSpecial }));
  const coordinateCount = stadiums.filter((stadium) => stadium.latitude !== null && stadium.longitude !== null).length;
  const tiles = mapTileConfig();
  return <div className="page-content map-page">
    <header className="page-heading"><h1>Mapa</h1></header>
    <p className="map-coverage">Estadios con coordenadas: {coordinateCount} de {stadiums.length}. Sin coordenadas: {stadiums.length - coordinateCount}.</p>
    <a href="#stadium-list" className="inline-link">Ir a la lista de estadios</a>
    <noscript><p>El mapa interactivo necesita JavaScript. Puedes consultar la cobertura y los enlaces de la lista de estadios.</p></noscript>
    {tiles ? <StadiumMap stadiums={mapStadiums} tiles={tiles} /> : <p className="map-section">El mapa no está disponible. Puedes usar la lista de estadios.</p>}
    {coordinateCount === 0 && <p>Todavía no hay coordenadas para mostrar marcadores.</p>}
    {!stadiums.length && <EmptyState eyebrow="Las chinchetas" title="Todavía no hay estadios" description="El mapa espera tus visitas." message="Todavía no hay estadios visitados publicados." />}
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
