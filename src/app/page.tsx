import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MapExplorer } from "@/components/map-explorer";
import type { MapStadium } from "@/components/stadium-map";
import { pageNumber } from "@/lib/pagination";
import { LoadMore } from "@/components/load-more";
import { loadTrips, loadStadiums } from "@/server/archive-lists";
import { TripFacts } from "@/components/trip-facts";
import { getHomeSummary, getTrip, getCollectionStadiums } from "@/db/public-archive";
import { crestMediaPath } from "@/lib/crest-key";
import { TerritorialSummary } from "@/components/territorial-summary";
import { formatLocation } from "@/lib/geography";
import { mapDetailHref, mapSelection } from "@/lib/map-navigation";
import { matchDate, tripTitle } from "@/lib/trips";
import { mapConfig } from "@/server/map-config";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const selection = mapSelection(params);
  if (selection.kind === "invalid") notFound();
  const stadiums = await getCollectionStadiums();
  const state = params.state ?? "all";
  if (state !== "all" && state !== "visited" && state !== "pending") notFound();
  const visitedCount = stadiums.filter((stadium) => stadium.visits > 0).length;
  const mapStadiums: MapStadium[] = stadiums.filter((stadium) => stadium.visits > 0).map((stadium) => ({ slug: stadium.slug, name: stadium.name, location: formatLocation(stadium.city, stadium.provinceCode), latitude: stadium.latitude, longitude: stadium.longitude, visits: stadium.visits, isSpecial: stadium.isSpecial, crestPath: crestMediaPath(stadium.markerCrestKey), crestClubName: stadium.markerClubName }));
  let title: string | null = null;
  let panel: ReactNode = null;
  let selectedSlug: string | null = null;
  let panelKey = "map";
  if (selection.kind === "stadium") {
    const stadium = stadiums.find((item) => item.slug === selection.slug);
    if (!stadium) notFound();
    const initial = stadium.visits > 0 ? await loadTrips(stadium.id, page) : null;
    selectedSlug = stadium.slug;
    title = stadium.name;
    panelKey = `stadium:${stadium.slug}`;
    panel = <>
      <Link href="/?view=stadiums" scroll={false} className="inline-link">← Colección de estadios</Link>
      <p>{formatLocation(stadium.city, stadium.provinceCode)}</p>
      <p className="collection-state">{stadium.visits ? `✓ Visitado · ${stadium.visits} ${stadium.visits === 1 ? "visita" : "visitas"}` : "○ Pendiente de visitar"}</p>
      {(stadium.latitude === null || stadium.longitude === null) && <p>Sin coordenadas: puedes consultar sus visitas y su estado aunque no aparezca en el mapa.</p>}
      {initial && <LoadMore key={`${stadium.slug}:${page}`} firstPage={page} baseHref={mapDetailHref("stadium", stadium.slug)} initial={initial} load={loadTrips.bind(null, stadium.id)} />}
    </>;
  } else if (selection.kind === "trip") {
    const trip = await getTrip(selection.slug);
    if (!trip) notFound();
    title = tripTitle(trip);
    panelKey = `trip:${trip.slug}`;
    selectedSlug = trip.stadiumSlug;
    const stadium = stadiums.find((item) => item.slug === selectedSlug);
    panel = <>
      <Link href={trip.stadiumSlug ? mapDetailHref("stadium", trip.stadiumSlug) : "/?view=trips"} scroll={false} className="inline-link">← {trip.stadiumName ?? "Viajes"}</Link>
      <p>{matchDate(trip.playedOn)}</p>
      {trip.isSpecial && <p className="special-label">Un partido especial</p>}
      {(!stadium || stadium.latitude === null || stadium.longitude === null) && <p>Este viaje no tiene una ubicación disponible en el mapa.</p>}
      <TripFacts trip={trip} onMap />
    </>;
  } else if (selection.kind === "view") {
    panelKey = selection.view;
    if (selection.view === "trips") {
      title = "Viajes";
      panel = <><p>Todos los viajes publicados, también los que todavía no tienen ubicación.</p><LoadMore key={`trips:${page}`} firstPage={page} baseHref="/?view=trips" initial={await loadTrips(undefined, page)} load={loadTrips.bind(null, undefined)} /></>;
    } else if (selection.view === "stadiums") {
      title = "Colección de estadios";
      panel = <>
        <p>Reto personal: todos los estadios registrados. El catálogo cambia al añadir o eliminar estadios; no representa todos los estadios existentes.</p>
        <p>{visitedCount} de {stadiums.length} visitados · {stadiums.length - visitedCount} {stadiums.length - visitedCount === 1 ? "pendiente" : "pendientes"}.</p>
        <nav className="list-pagination collection-filters" aria-label="Filtrar colección">{([['all', 'Todos'], ['visited', 'Visitados'], ['pending', 'Pendientes']] as const).map(([value, label]) => <Link key={value} href={`/?view=stadiums&state=${value}`} scroll={false} aria-current={state === value ? "page" : undefined}>{label}</Link>)}</nav>
        {!stadiums.length && <p>Todavía no hay estadios registrados.</p>}
        <LoadMore key={`stadiums:${state}:${page}`} firstPage={page} baseHref={`/?view=stadiums&state=${state}`} initial={await loadStadiums(state, page)} load={loadStadiums.bind(null, state)} />
      </>;
    } else {
      title = "El archivo en cifras";
      const summary = await getHomeSummary();
      panel = <><TerritorialSummary stadiums={stadiums} /><dl className="explorer-totals">{[["Viajes", summary.trips], ["Estadios conocidos", summary.stadiums], ["Victorias", summary.wins], ["Empates", summary.draws], ["Derrotas", summary.losses]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>Resultados conocidos de partidos finalizados: {summary.knownResults} de {summary.trips} viajes.</p><p>Estadio conocido: {summary.knownVenues} de {summary.trips} viajes.</p><p>Victorias, empates y derrotas según los goles jugados, incluida la prórroga y sin contar la tanda de penaltis.</p>
      </>;
    }
  }
  const coordinateCount = mapStadiums.filter((stadium) => stadium.latitude !== null && stadium.longitude !== null).length;
  const information = <>
    <p>Estadios con coordenadas: {coordinateCount} de {visitedCount}. Sin coordenadas: {visitedCount - coordinateCount}.</p>
    {coordinateCount === 0 && <p>Todavía no hay coordenadas para mostrar marcadores.</p>}
    {!stadiums.length && <p>Todavía no hay estadios registrados.</p>}
    <p>El mapa muestra solo estadios visitados. Los pendientes se pueden consultar en la colección. El borde resaltado identifica el estadio seleccionado.</p>
    <Link href="/?view=stadiums" scroll={false} className="inline-link">Consultar estadios del archivo</Link>
  </>;
  return <MapExplorer stadiums={mapStadiums} config={mapConfig()} selectedSlug={selectedSlug} panelKey={panelKey} title={title} information={information}>{panel}</MapExplorer>;
}
