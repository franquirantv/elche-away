"use client";
import { PagedReview } from "./paged-review";
import { useActionState, useState } from "react";
import { importFixtures } from "@/app/admin/import-actions";
import { importCategoryLabels, type ImportState } from "@/server/import-types";

const fieldLabels: Record<string, string> = { homeClubId: "Club local", awayClubId: "Club visitante", playedOn: "Fecha", homeScore: "Goles local", awayScore: "Goles visitante", seasonId: "Temporada", competitionId: "Competición", phase: "Jornada o fase", status: "Estado", stadiumId: "Estadio", factualNotes: "Anotaciones factuales" };
type References = { clubs: { id: string; name: string }[]; seasons: { id: string; label: string }[]; competitions: { id: string; name: string }[] };
export function ImportForm({ references }: { references: References }) {
  const [dirty, setDirty] = useState(false);
  // Only FormData is sent to the server. Do not serialize the previous state
  // (which contains the uploaded file and the signed review) with every request.
  const [state, action, pending] = useActionState(async (previous: ImportState, form: FormData): Promise<ImportState> => {
    const result = await importFixtures(form);
    setDirty(false);
    return result.ok ? result : { ...previous, ...result, token: undefined };
  }, { ok: false, message: "" });
  const input = state.input;
  const preview = state.preview;
  function display(key: string, value: string | number | null) {
    if (value === null) return "Desconocido";
    if (key === "homeClubId" || key === "awayClubId") return references.clubs.find((r) => r.id === value)?.name ?? value;
    if (key === "seasonId") return references.seasons.find((r) => r.id === value)?.label ?? value;
    if (key === "competitionId") return references.competitions.find((r) => r.id === value)?.name ?? value;
    if (key === "status") return ({ unknown: "Desconocido", finished: "Finalizado", scheduled: "Programado", postponed: "Aplazado", abandoned: "Abandonado", cancelled: "Cancelado" } as Record<string, string>)[value] ?? value;
    return value;
  }
  return <section aria-label="Importación explícita" className="admin-records">
    <form action={action} className="admin-card reference-form">
      <h2>1. Cargar archivo</h2><p>Hasta 350000 bytes. Cada lote contiene como máximo 40 partidos del Elche. No se descarga nada desde la aplicación.</p>
      <label className="admin-field"><span>Repositorio de origen</span><select name="repository"><option>openfootball/football.json</option><option>openfootball/espana</option></select></label>
      <label className="admin-field"><span>Ruta del archivo dentro del repositorio</span><input name="path" required maxLength={200} placeholder="2024-25/es.2.json" /></label>
      <label className="admin-field"><span>Revisión Git de origen (40 caracteres)</span><input name="revision" required pattern="[a-f0-9]{40}" maxLength={40} /></label>
      <label className="admin-field"><span>Formato</span><select name="format"><option value="json">JSON</option><option value="txt">Football.TXT</option></select></label>
      <label className="admin-field"><span>Archivo local</span><input name="file" type="file" accept=".json,.txt" required /></label>
      <label className="admin-field"><span>Nombre exacto del Elche en el archivo</span><input name="elcheName" defaultValue="Elche CF" required maxLength={200} /></label>
      <label className="admin-field"><span>Temporada local</span><select name="seasonId" required><option value="">Seleccionar</option>{references.seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="admin-field"><span>Competición local</span><select name="competitionId" required><option value="">Seleccionar</option>{references.competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="admin-field"><span>Omitir los primeros partidos del Elche (0 para empezar)</span><input name="offset" type="number" min="0" max="2000" defaultValue="0" required /></label>
      <label><input type="checkbox" name="resultsConfirmed" value="yes" /> He comprobado que los marcadores presentes son resultados finales jugados, incluida prórroga y sin sumar tandas. Si no, conservar estado desconocido.</label>
      <button className="button-link" name="intent" value="inspect" disabled={pending}>Leer archivo sin guardar</button>
    </form>
    {input && state.names && <form key={JSON.stringify(input)} onChange={() => setDirty(true)} action={action} className="reference-form admin-card">
      <input type="hidden" name="input" value={JSON.stringify(input)} />
      <h2>2. Asignar referencias y revisar decisiones</h2>
      <p>Los nombres solo se vinculan a las referencias que elijas. Si falta una, créala en administración y vuelve a cargar el archivo.</p>
      <PagedReview key={JSON.stringify(input.mappings)} label="Referencias de importación" items={state.names.map((name, i) => ({ key: name, fields: { [`club-${i}`]: input.mappings[name] ?? "" }, content: <label className="admin-field" key={name}><span>{name}</span><select name={`club-${i}`} required defaultValue={input.mappings[name] ?? ""}><option value="">Seleccionar club local</option>{references.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label> }))} />
      {preview && <>
        <h3>Preview: {preview.seasonLabel} · {preview.competitionLabel}</h3>
        <p>Partidos {preview.offset + 1}–{preview.offset + preview.rows.length} de {preview.total} encontrados para Elche en este archivo. Este recuento no acredita una temporada completa.</p>
        <p>Las decisiones que cambies abajo requieren generar y revisar un nuevo preview antes de aplicar. Los registros reconocidos conservan su vínculo histórico.</p>
        <PagedReview key={state.token ?? JSON.stringify(preview.rows.map((row) => row.target))} label="Partidos de importación" items={preview.rows.map((row, i) => ({ key: row.fingerprint, fields: { [`target-${i}`]: row.target }, content: <fieldset key={row.fingerprint} className="admin-card">
          <legend>{row.label}</legend><p><strong>{importCategoryLabels[row.category]}</strong></p>
          <p>Origen: {input.repository} · {input.path} · {input.revision}</p>
          <p>Datos del archivo: {row.incoming.homeScore ?? "?"} – {row.incoming.awayScore ?? "?"} · {display("status", row.incoming.status)} · {row.incoming.phase ?? "Fase desconocida"}</p>
          <label className="admin-field"><span>Decisión para este registro</span><select name={`target-${i}`} defaultValue={row.target}>
            <option value="">Sin decidir</option><option value="skip">Omitir este registro</option><option value="new">Confirmo que es un partido nuevo</option>
            <optgroup label="Candidatos por equipos, fecha o datos incompletos">{preview.candidates.filter((candidate) => row.candidateIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>Vincular a {candidate.label}</option>)}</optgroup>
            <optgroup label="Otros partidos locales de la temporada">{preview.candidates.filter((candidate) => !row.candidateIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>Vincular a {candidate.label}</option>)}</optgroup>
          </select></label>
          {row.issue && <p className="form-error">{row.issue}</p>}
          {row.existing && <p>Partido local vinculado: {row.target}. {row.category === "protected" ? "Todos sus hechos se conservarán; solo se registra la procedencia." : "Los campos ausentes no borran datos locales."}</p>}
          {row.changes.length > 0 && <ul>{row.changes.map((key) => <li key={key}>{fieldLabels[key]}: {display(key, row.existing![key as keyof typeof row.existing])} → {display(key, row.proposed[key as keyof typeof row.proposed])}{row.category === "protected" ? " (protegido; no se aplicará)" : ""}</li>)}</ul>}
          {!row.target && <p className="form-error">Elige vincular, crear u omitir y genera otro preview.</p>}
        </fieldset> }))} />
      </>}
      <button className="button-link" name="intent" value="preview" disabled={pending}>{preview ? "Actualizar preview con estas decisiones" : "Generar preview"}</button>
    </form>}
    {preview && state.token && <form action={action} className="admin-card reference-form">
      <h2>3. Aplicar el preview revisado</h2>{dirty && <p role="status">Has cambiado decisiones. Genera y revisa otro preview antes de aplicar.</p>}<input type="hidden" name="token" value={state.token} />
      <p>Se aplican únicamente las decisiones del último preview generado, en un lote completo. Si cambian los datos locales o pasan 30 minutos, tendrás que generar otro.</p>
      <label><input name="confirmApply" type="checkbox" value="yes" required /> Confirmo los vínculos, altas, actualizaciones y omisiones del último preview. He pulsado «Actualizar preview» después de modificar decisiones.</label>
      <button className="button-link" name="intent" value="apply" disabled={pending || dirty || preview.rows.some((row) => !row.target || Boolean(row.issue))}>Aplicar lote revisado</button>
    </form>}
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
  </section>;
}
