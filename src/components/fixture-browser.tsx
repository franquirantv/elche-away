import { Pagination } from "./pagination";
import { PAGE_SIZE, pageNumber } from "@/lib/pagination";
import Link from "next/link";
import { getAdminFixtures } from "@/server/fixtures";
import type { readReferences } from "@/db/references";
import { FixtureForm } from "./fixture-form";
import { fixtureStatuses } from "@/server/fixture-input";
import { matchDate, tripScore } from "@/lib/trips";
import { InvalidReference } from "@/server/reference-input";

export async function FixtureBrowser({ references, filters }: {
  references: Awaited<ReturnType<typeof readReferences>>;
  filters: { seasonId?: string; competitionId?: string; page?: string };
}) {
  let rows;
  try { rows = await getAdminFixtures({ ...filters, page: pageNumber(filters.page) }); }
  catch (error) { if (!(error instanceof InvalidReference)) throw error; return <p role="alert">Filtro no válido. <Link href="/admin">Volver a todos los partidos</Link></p>; }
  const clubName = (id: string | null) => references.clubs.find((club) => club.id === id)?.name ?? "Club desconocido";
  return <>
    <h2 className="group-title">Partidos locales</h2>
    <form className="reference-form admin-card" action="/admin">
      <label className="admin-field"><span>Temporada</span><select name="seasonId" defaultValue={filters.seasonId ?? ""}><option value="">Todas las temporadas</option>{references.seasons.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}</select></label>
      <label className="admin-field"><span>Competición</span><select name="competitionId" defaultValue={filters.competitionId ?? ""}><option value="">Todas las competiciones</option>{references.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label>
      <button className="button-link">Filtrar partidos</button><Link className="text-link" href="/admin">Quitar filtros</Link>
    </form>
    <details className="admin-card"><summary>Añadir partido</summary><FixtureForm options={references} /></details>
    <section className="admin-records" aria-label="Partidos existentes">
      {rows.slice(0, PAGE_SIZE).map(({ fixture, personal }) => {
        const season = references.seasons.find((item) => item.id === fixture.seasonId);
        return <article key={fixture.id} className="admin-card">
          <h3>{clubName(fixture.homeClubId)} – {clubName(fixture.awayClubId)}</h3>
          <p>{matchDate(fixture.playedOn)} · {tripScore(fixture)} · {fixtureStatuses[fixture.status]}</p>
          <p>Temporada: {season?.label ?? "Desconocida"} · División del Elche: {references.tiers.find((tier) => tier.id === season?.elcheTierId)?.name ?? "Desconocida"}</p>
          <p>Competición: {references.competitions.find((item) => item.id === fixture.competitionId)?.name ?? "Desconocida"} · Estadio: {references.stadiums.find((item) => item.id === fixture.stadiumId)?.name ?? "Desconocido"}</p>
          <p>{fixture.factsLocked ? "Datos locales bloqueados" : "Datos sin bloqueo local"} · {personal ? "Asistencia publicada" : "Sin asistencia"}</p>
          {personal && <Link className="text-link" href={`/trips/${personal.slug}`}>Ver viaje público</Link>}
          <details><summary>{personal ? "Editar asistencia" : "Marcar asistencia"}</summary><FixtureForm record={fixture} personal={personal} options={references} attendanceOnly /></details>
          <details><summary>Corregir o eliminar partido</summary><FixtureForm record={fixture} options={references} /></details>
        </article>;
      })}
      {!rows.length && <p>No hay partidos locales para estos filtros. Puedes añadir un partido manualmente.</p>}
    </section>
    <Pagination page={pageNumber(filters.page)} hasMore={rows.length > PAGE_SIZE} params={filters} />
  </>;
}
