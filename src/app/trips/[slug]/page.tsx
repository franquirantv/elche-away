import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrip } from "@/db/public-archive";
import { matchDate, statusLabels, tripScore, tripTitle } from "@/lib/trips";
import { formatLocation } from "@/lib/geography";

export const metadata: Metadata = { title: "Detalle del viaje" };

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await getTrip(slug);
  if (!trip) notFound();
  return (
    <article className="page-content">
      <Link className="text-link" href="/trips">← Todos los viajes</Link>
      <header className="page-heading detail-heading">
        <p className="eyebrow">El archivo / Viaje</p>
        <h1>{tripTitle(trip)}</h1>
        <p className="lead">{matchDate(trip.playedOn)}</p>
        {trip.isSpecial && <p className="special-label">Un partido especial</p>}
      </header>
      <dl className="detail-grid">
        <div><dt>Resultado</dt><dd>{tripScore(trip)}</dd></div>
        <div><dt>Estado</dt><dd>{statusLabels[trip.status]}</dd></div>
        <div><dt>Temporada</dt><dd>{trip.season ?? "Temporada desconocida"}</dd></div>
        <div><dt>Competición</dt><dd>{trip.competition ?? "Competición desconocida"}</dd></div>
        <div><dt>División del Elche en esa temporada</dt><dd>{trip.tier ?? "División desconocida"}</dd></div>
        <div><dt>Fase</dt><dd>{trip.phase ?? "Fase desconocida"}</dd></div>
        <div><dt>Estadio</dt><dd>{trip.stadiumSlug ? <Link className="inline-link" href={`/stadiums/${trip.stadiumSlug}`}>{trip.stadiumName}</Link> : "Estadio desconocido"}</dd></div>
        <div><dt>Ubicación</dt><dd>{formatLocation(trip.city, trip.provinceCode)}</dd></div>
      </dl>
      <section className="detail-notes"><h2>Recuerdos del viaje</h2><p>{trip.notes ?? "Todavía no hay notas para este viaje."}</p></section>
      {trip.factualNotes && <section className="detail-notes"><h2>Información del partido</h2><p>{trip.factualNotes}</p></section>}
    </article>
  );
}
