import Link from "next/link";
import type { PublicTrip } from "@/db/queries";
import { statusLabels, tripScore } from "@/lib/trips";
import { formatLocation } from "@/lib/geography";
import { mapDetailHref } from "@/lib/map-navigation";

export function TripFacts({ trip, onMap = false }: { trip: PublicTrip; onMap?: boolean }) {
  return <>
      <dl className="detail-grid">
        <div><dt>Resultado</dt><dd>{tripScore(trip)}</dd></div>
        <div><dt>Estado</dt><dd>{statusLabels[trip.status]}</dd></div>
        <div><dt>Temporada</dt><dd>{trip.season ?? "Temporada desconocida"}</dd></div>
        <div><dt>Competición</dt><dd>{trip.competition ?? "Competición desconocida"}</dd></div>
        <div><dt>División del Elche en esa temporada</dt><dd>{trip.tier ?? "División desconocida"}</dd></div>
        <div><dt>Fase</dt><dd>{trip.phase ?? "Fase desconocida"}</dd></div>
        <div><dt>Estadio</dt><dd>{trip.stadiumSlug ? <Link className="inline-link" href={onMap ? mapDetailHref("stadium", trip.stadiumSlug) : `/stadiums/${trip.stadiumSlug}`} scroll={!onMap}>{trip.stadiumName}</Link> : "Estadio desconocido"}</dd></div>
        <div><dt>Ubicación</dt><dd>{formatLocation(trip.city, trip.provinceCode)}</dd></div>
      </dl>
      <section className="detail-notes"><h2>Recuerdos del viaje</h2><p>{trip.notes ?? "Todavía no hay notas para este viaje."}</p></section>
      {trip.factualNotes && <section className="detail-notes"><h2>Información del partido</h2><p>{trip.factualNotes}</p></section>}
  </>;
}
