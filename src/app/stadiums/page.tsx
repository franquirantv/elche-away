import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { getVisitedStadiums } from "@/db/public-archive";
import { formatLocation } from "@/lib/geography";

export const metadata: Metadata = { title: "Estadios" };

export default async function StadiumsPage() {
  const stadiums = await getVisitedStadiums();
  if (!stadiums.length) return <EmptyState eyebrow="02 / Las gradas" title="Estadios" description="Cada estadio visitado tiene un lugar en esta historia." message="Todavía no hay estadios publicados." />;
  return (
    <div className="page-content">
      <header className="page-heading"><p className="eyebrow">02 / Las gradas</p><h1>Estadios</h1><p className="lead">Cada estadio visitado tiene un lugar en esta historia.</p></header>
      <ul className="stadium-grid">
        {stadiums.map((stadium) => <li key={stadium.slug} className="trip-card">
          <span className="eyebrow">{stadium.visits} {stadium.visits === 1 ? "visita" : "visitas"}</span>
          <h2><Link href={`/stadiums/${stadium.slug}`}>{stadium.name}</Link></h2>
          <p>{formatLocation(stadium.city, stadium.provinceCode)}</p>
        </li>)}
      </ul>
    </div>
  );
}
