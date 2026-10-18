import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getAdminReferences } from "@/server/admin";
import { AccessDenied } from "@/server/admin-policy";
import { referenceKinds, type ReferenceKind } from "@/server/reference-input";
import { ReferenceForm } from "@/components/reference-form";
import { FixtureBrowser } from "@/components/fixture-browser";
import { ELCHE_CLUB_ID } from "@/lib/identity";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };
const labels: Record<ReferenceKind, string> = { clubs: "Clubes", stadiums: "Estadios", competitions: "Competiciones", tiers: "Divisiones", seasons: "Temporadas" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; seasonId?: string; competitionId?: string }> }) {
  // Keep runtime rendering outside the authorization error handler.
  await connection();
  let references;
  try { references = await getAdminReferences(); }
  catch (error) {
    if (!(error instanceof AccessDenied)) throw error;
    return <div className="page-content page-heading"><h1>Acceso restringido</h1><p className="lead">Tu identidad no está autorizada para administrar el archivo.</p><Link href="/auth/account" className="text-link">Consultar mi sesión</Link></div>;
  }
  const params = await searchParams;
  const { section } = params;
  const kind: ReferenceKind = referenceKinds.includes(section as ReferenceKind) ? section as ReferenceKind : "clubs";
  return <div className="page-content">
    <header className="page-heading"><p className="eyebrow">Área privada</p><h1>Administración</h1><p className="lead">Gestiona los partidos locales, tus asistencias y las referencias del archivo.</p><Link href="/auth/account" className="text-link">Mi sesión y cierre de sesión</Link></header>
    <nav className="admin-tabs" aria-label="Administración"><Link href="/admin" aria-current={!section || section === "fixtures" ? "page" : undefined}>Partidos</Link>{referenceKinds.map((item) => <Link key={item} href={`/admin?section=${item}`} aria-current={section === item ? "page" : undefined}>{labels[item]}</Link>)}</nav>
    {!section || section === "fixtures" ? <FixtureBrowser references={references} filters={params} /> : <>
    <h2 className="group-title">{labels[kind]}</h2>
    {kind === "seasons" && <p className="admin-hint">La división pertenece a la temporada del Elche, no a cada partido ni a su competición.</p>}
    <section className="admin-card"><h3>Crear referencia</h3><ReferenceForm kind={kind} tierOptions={references.tiers} key={kind} /></section>
    <section aria-label="Referencias existentes" className="admin-records">
      {references[kind].map((record) => <details key={`${record.id}:${record.updatedAt.toISOString()}`} className="admin-card"><summary>{"name" in record ? record.name : record.label}</summary><ReferenceForm kind={kind} record={record} tierOptions={references.tiers} protectedClub={kind === "clubs" && record.id === ELCHE_CLUB_ID} /></details>)}
      {!references[kind].length && <p>No hay referencias de este tipo todavía.</p>}
    </section></>}
  </div>;
}
