import Link from "next/link";
import type { PublicTrip } from "@/db/queries";
import { matchDate, tripScore, tripTitle } from "@/lib/trips";

export function TripList({ trips }: { trips: PublicTrip[] }) {
  const dated = trips.filter((trip) => trip.playedOn !== null);
  const undated = trips.filter((trip) => trip.playedOn === null);
  return (
    <div className="trip-groups">
      {[{ title: "Partidos con fecha", rows: dated }, { title: "Fecha desconocida", rows: undated }].map(({ title, rows }) => rows.length > 0 && (
        <section key={title} aria-label={title}>
          <h2 className="group-title">{title}</h2>
          <ul className="trip-list">
            {rows.map((trip) => (
              <li key={trip.slug} className="trip-card">
                <div className="trip-card-meta">
                  {trip.playedOn ? <time dateTime={trip.playedOn}>{matchDate(trip.playedOn)}</time> : <span>Fecha desconocida</span>}
                  <span>{trip.season ?? "Temporada desconocida"}</span>
                  {trip.isSpecial && <span className="special-label">Un partido especial</span>}
                </div>
                <h3><Link href={`/trips/${trip.slug}`}>{tripTitle(trip)}</Link></h3>
                <p className="trip-score">{tripScore(trip)}</p>
                <p>{trip.competition ?? "Competición desconocida"} · {trip.stadiumName ?? "Estadio desconocido"}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
