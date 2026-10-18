import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getAdminReferences } from "@/server/admin";
import { AccessDenied } from "@/server/admin-policy";
import { ImportForm } from "@/components/import-form";
export const metadata: Metadata = { title: "Importar partidos", robots: { index: false, follow: false } };
export default async function ImportPage() {
  await connection();
  let references;
  try { references = await getAdminReferences(); }
  catch (error) {
    if (!(error instanceof AccessDenied)) throw error;
    return <div className="page-content page-heading"><h1>Acceso restringido</h1><p>Tu identidad no está autorizada para importar.</p></div>;
  }
  return <div className="page-content">
    <header className="page-heading"><p className="eyebrow">Área privada</p><h1>Importar partidos</h1><p className="lead">Carga un archivo de OpenFootball, revisa las coincidencias y confirma cada lote. La cobertura puede ser parcial.</p><Link className="text-link" href="/admin">Volver a partidos y referencias</Link></header>
    <p>La importación no marca asistencias. Las correcciones locales y los recuerdos se conservan. Completa los huecos desde la gestión manual.</p>
    <ImportForm references={{ clubs: references.clubs.map(({ id, name }) => ({ id, name })), seasons: references.seasons.map(({ id, label }) => ({ id, label })), competitions: references.competitions.map(({ id, name }) => ({ id, name })) }} />
  </div>;
}
