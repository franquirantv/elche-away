import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TripList } from "@/components/trip-list";
import { getTrips, getVisitedStadium } from "@/db/public-archive";
import { formatLocation } from "@/lib/geography";

export const metadata: Metadata = { title: "Detalle del estadio" };

export default async function StadiumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stadium = await getVisitedStadium(slug);
  if (!stadium) notFound();
  const trips = await getTrips(stadium.id);
  return (
    <div className="page-content">
      <Link href="/stadiums" className="text-link">← Todos los estadios</Link>
      <header className="page-heading detail-heading"><p className="eyebrow">Las gradas / Estadio</p><h1>{stadium.name}</h1><p className="lead">{formatLocation(stadium.city, stadium.provinceCode)}</p></header>
      <p>{trips.length} {trips.length === 1 ? "visita en el archivo" : "visitas en el archivo"}. Los clubes de cada partido no indican quién utiliza actualmente el estadio.</p>
      <TripList trips={trips} />
    </div>
  );
}
