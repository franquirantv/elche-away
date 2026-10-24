import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrip } from "@/db/public-archive";
import { matchDate, tripTitle } from "@/lib/trips";
import { TripFacts } from "@/components/trip-facts";

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
      <TripFacts trip={trip} />
    </article>
  );
}
