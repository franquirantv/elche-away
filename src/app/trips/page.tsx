import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { TripList } from "@/components/trip-list";
import { getTrips } from "@/db/public-archive";

export const metadata: Metadata = { title: "Viajes" };

export default async function TripsPage() {
  const trips = await getTrips();
  if (!trips.length) return <EmptyState eyebrow="01 / El archivo" title="Viajes" description="Los partidos vividos siguiendo al Elche, lejos de casa." message="Todavía no hay viajes publicados." />;
  return (
    <div className="page-content">
      <header className="page-heading"><p className="eyebrow">01 / El archivo</p><h1>Viajes</h1><p className="lead">Los partidos vividos siguiendo al Elche, lejos de casa.</p></header>
      <TripList trips={trips} />
    </div>
  );
}
