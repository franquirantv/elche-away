"use client";
import { PagedReview } from "./paged-review";
import { useActionState, useRef, useState } from "react";
import { directImport } from "@/app/admin/global-import-actions";
import { importCategoryLabels } from "@/server/import-types";
import type { GlobalImportState, GlobalPreview } from "@/server/global-import-types";

const storageKey = "elche-away-direct-import-review";
const coverageLabels = { available: "Disponible (parcial)", missing: "Sin archivo compatible", "no-elche": "Sin registros exactos del Elche", error: "Error de obtención", unverified: "Cobertura no acreditada" };
const refLabels = { clubs: "Club", seasons: "Temporada", competitions: "Competición" };
const factLabels: Record<string, string> = { homeClubId: "Local", awayClubId: "Visitante", homeScore: "Goles local", awayScore: "Goles visitante", playedOn: "Fecha", phase: "Fase", status: "Estado", seasonId: "Temporada", competitionId: "Competición", stadiumId: "Estadio", factualNotes: "Anotaciones factuales" };
function factValue(preview: GlobalPreview, key: string, value: string | number | null) {
  if (value === null) return "Desconocido";
  if (key === "homeClubId" || key === "awayClubId") return preview.options.clubs.find((r) => r.id === value)?.name ?? value;
  if (key === "seasonId") return preview.options.seasons.find((r) => r.id === value)?.label ?? value;
  if (key === "competitionId") return preview.options.competitions.find((r) => r.id === value)?.name ?? value;
  if (key === "status") return ({ finished: "Finalizado", unknown: "Desconocido", scheduled: "Programado", postponed: "Aplazado", cancelled: "Cancelado", abandoned: "Abandonado" } as Record<string, string>)[value] ?? value;
  return value;
}
export function DirectImportForm({ currentYear }: { currentYear: number }) {
  const stop = useRef(false);
  const [live, setLive] = useState<GlobalImportState>();
  const [dirty, setDirty] = useState(false);
  const [applyingBatches, setApplyingBatches] = useState(false);
  const [state, action, pending] = useActionState(async (previous: GlobalImportState, form: FormData): Promise<GlobalImportState> => {
    stop.current = false; setLive(undefined);
    let last = previous;
    try {
      if (form.get("intent") === "restore") {
        const token = sessionStorage.getItem(storageKey);
        if (!token) return { ...previous, ok: false, message: "No hay un estado guardado en esta pestaña. Solicita una comprobación nueva." };
        form.set("intent", "resume"); form.set("token", token);
      }
      const applying = form.get("intent") === "apply";
      setApplyingBatches(applying);
      for (let request = 0; request < 200; request++) {
        const result = await directImport(form);
        if (!result.ok) { if (!applying) setDirty(true); return { ...last, ...result }; }
        setDirty(false);
        last = result;
        if (result.token) { try { sessionStorage.setItem(storageKey, result.token); } catch { /* The live signed review still works without browser storage. */ } }
        if (!applying) return result;
        setLive(result);
        if ((result.nextIndex ?? 0) >= (result.batchCount ?? 0)) return { ...result, message: "Importación terminada. Revisa el resultado de cada lote y completa las lagunas con 4a." };
        if (stop.current) return { ...result, message: "Proceso detenido entre lotes. Los anteriores se conservan; pulsa continuar para reanudar." };
        // This loop exists only inside the owner's explicit confirmed action.
        // Closing/stopping this page stops further requests; there is no job.
        form = new FormData(); form.set("intent", "apply"); form.set("token", result.token!); form.set("confirmGlobal", "yes");
      }
      return { ...last, message: "Límite de lotes de esta acción alcanzado. Continúa explícitamente desde aquí." };
    } catch {
      return { ...last, ok: false, message: "Se perdió la conexión o la respuesta. Recupera el estado y reanuda explícitamente; los lotes confirmados no se repetirán." };
    } finally { setLive(undefined); setApplyingBatches(false); }
  }, { ok: false, message: "" });
  const shown = live ?? state;
  const preview = shown.preview;
  const completed = (shown.nextIndex ?? 0) >= (shown.batchCount ?? 0) && Boolean(shown.approved);
  const unresolvedIds = new Set(preview?.references.filter((r) => !r.choice).map((r) => r.id));
  const newIds = new Set(preview?.references.filter((r) => r.choice === "new").map((r) => r.id));
  return <section className="admin-records" aria-label="Importación directa desde OpenFootball">
    <form action={action} className="admin-card reference-form">
      <h2>1. Comprobar histórico o actualizaciones</h2>
      <p>El rango histórico empieza en 2017/18. La comprobación obtiene los archivos disponibles de OpenFootball y conserva automáticamente su procedencia. No guarda partidos ni referencias.</p>
      <label className="admin-field"><span>Desde la temporada</span><select name="startYear" defaultValue="2017">{Array.from({ length: currentYear - 2017 + 2 }, (_, i) => 2017 + i).map((year) => <option value={year} key={year}>{year}/{String(year + 1).slice(-2)}</option>)}</select></label>
      <label className="admin-field"><span>Hasta la temporada</span><select name="endYear" defaultValue={currentYear}>{Array.from({ length: currentYear - 2017 + 2 }, (_, i) => 2017 + i).map((year) => <option value={year} key={year}>{year}/{String(year + 1).slice(-2)}</option>)}</select></label>
      <button className="button-link" name="intent" value="check" disabled={pending}>{pending ? "Procesando…" : "Comprobar datos disponibles"}</button>
    </form>
    <form action={action} className="admin-card"><button className="text-link" name="intent" value="restore" disabled={pending}>Recuperar revisión y progreso guardados en esta pestaña</button><p>La recuperación no aplica lotes ni consulta OpenFootball. Si la revisión caducó, comprueba de nuevo; las importaciones aceptadas se reconocen por su procedencia.</p></form>
    {shown.acquisition && <section className="admin-card">
      <h2>Cobertura del rango solicitado</h2>
      <p>La presencia de un archivo o de resultados no acredita una temporada completa. Los errores de obtención se distinguen de los archivos ausentes.</p>
      <details><summary>Revisiones de origen utilizadas</summary><ul>{Object.entries(shown.acquisition.revisions).map(([repository, revision]) => <li key={repository}>{repository}: <code>{revision}</code></li>)}</ul></details>
      <PagedReview label="Cobertura de importación" items={shown.acquisition.coverage.map((entry, i) => ({ key: String(i), content: <p><strong>{entry.season} · {entry.competition}: {coverageLabels[entry.status]}</strong>. {entry.message}{entry.path && <> ({entry.repository}/{entry.path})</>}</p> }))} />
    </section>}
    {preview && !shown.approved && <form key={shown.token} action={action} onChange={() => setDirty(true)} className="admin-card reference-form">
      <input type="hidden" name="token" value={shown.token} />
      <h2>2. Preview global: {preview.total} registros · {preview.batches.length} lotes</h2>
      <ul aria-label="Resumen global de categorías">{Object.entries(importCategoryLabels).map(([category, label]) => <li key={category}>{label}: {preview.batches.reduce((n, batch) => n + batch.rows.filter((row) => row.category === category).length, 0)}</li>)}</ul>
      <p>Revisa las referencias nuevas y los partidos de TODAS las temporadas. Nada se escribirá antes de confirmar este preview. Las referencias ambiguas y los conflictos pendientes requieren una decisión.</p>
      <h3>Referencias propuestas</h3>
      <p>Se propone crear {preview.references.filter((r) => r.choice === "new").length} referencias. No se asignan divisiones ni estadios.</p>
      <PagedReview label="Referencias propuestas" items={preview.references.map((ref, i) => ({ key: ref.key, fields: { [`ref-${i}`]: ref.choice }, content: <label className="admin-field" key={ref.key}><span>{refLabels[ref.kind]}: {ref.name} — {ref.choice === "new" ? "SE CREARÁ" : ref.choice ? newIds.has(ref.choice) ? "Referencia nueva compartida" : "Referencia existente" : "Coincidencia ambigua; selecciona"}</span>
        <select name={`ref-${i}`} defaultValue={ref.choice} disabled={pending}>
          <option value="">Sin resolver</option><option value="new">Crear {refLabels[ref.kind].toLowerCase()}: {ref.name}</option>
          {preview.options[ref.kind].filter((r) => !unresolvedIds.has(r.id) && (r.id !== ref.id || ref.choice === r.id)).map((r) => <option value={r.id} key={r.id}>{newIds.has(r.id) ? "Se creará: " : ""}{"name" in r ? r.name : r.label} · {r.id}</option>)}
        </select>
      </label> }))} />
      <h3>Partidos y decisiones</h3>
      <label><input type="checkbox" name="resultsConfirmed" value="yes" defaultChecked={preview.resultsConfirmed} disabled={pending} /> He revisado los marcadores presentes y confirmo que son resultados finales jugados, con prórroga y sin tanda. Actualiza el preview para revisar este cambio; sin confirmación, el estado entrante será desconocido.</label>
      <PagedReview label="Partidos de importación" items={preview.batches.flatMap((batch, i) => batch.rows.map((row) => ({ key: row.sourceId, fields: { [`target-${row.sourceId}`]: row.target }, content: <fieldset className="admin-card" key={row.sourceId}>
          <legend>{row.label}</legend><p>Lote {i + 1}: {batch.label}</p><p><strong>{importCategoryLabels[row.category]}</strong> · {row.incoming.homeScore ?? "?"} – {row.incoming.awayScore ?? "?"} · {factValue(preview, "status", row.incoming.status)} · {row.incoming.phase ?? "Fase desconocida"}</p>
          <label className="admin-field"><span>Decisión</span><select name={`target-${row.sourceId}`} defaultValue={row.target} disabled={pending}>
            <option value="">Sin decidir</option><option value="new">Confirmar como partido nuevo</option><option value="skip">Omitir</option>
            <optgroup label="Candidatos por equipos, fecha o datos incompletos">{batch.candidates.filter((c) => row.candidateIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>Vincular a {c.label}</option>)}</optgroup>
            <optgroup label="Otros partidos locales de la temporada">{batch.candidates.filter((c) => !row.candidateIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>Vincular a {c.label}</option>)}</optgroup>
          </select></label>
          {row.issue && <p className="form-error">{row.issue}</p>}
          {row.category === "protected" && <p>Se conservarán todos los hechos locales. Solo se añadirá procedencia.</p>}
          {row.changes.length > 0 && <ul>{row.changes.map((key) => <li key={key}>{factLabels[key]}: {factValue(preview, key, row.existing![key as keyof typeof row.existing])} → {factValue(preview, key, row.proposed[key as keyof typeof row.proposed])}{row.category === "protected" ? " (protegido; no se aplicará)" : ""}</li>)}</ul>}
        </fieldset> })))} />
      <p>Marcar un conflicto como nuevo puede crear otro partido: revisa antes sus candidatos. Cambiar referencias obliga a revisar de nuevo las decisiones.</p>
      <button className="button-link" name="intent" value="preview" disabled={pending}>Actualizar preview global</button>
      <button className="text-link" name="intent" value="new-pending" disabled={pending}>Marcar los partidos pendientes como nuevos y revisar</button>
      <button className="text-link" name="intent" value="skip-pending" disabled={pending}>Omitir partidos pendientes y revisar</button>
    </form>}
    {shown.token && !completed && (preview || shown.approved) && <form action={action} className="admin-card reference-form">
      <input type="hidden" name="token" value={shown.token} />
      <h2>3. {shown.approved ? "Continuar importación" : "Confirmar preview global"}</h2>
      {dirty && <p>Has cambiado decisiones. Actualiza y revisa el preview antes de aplicar.</p>}
      <p>Se procesarán lotes de hasta 40 registros mientras esta página permanezca abierta. Puedes detenerte entre lotes. Si falla uno, los anteriores se conservan y podrás reanudar explícitamente.</p>
      <label><input type="checkbox" name="confirmGlobal" value="yes" required disabled={pending} /> {shown.approved ? "Confirmo que quiero continuar con las decisiones ya revisadas." : "He revisado todo el preview, sus referencias nuevas, las altas, actualizaciones, conflictos resueltos y lagunas. Confirmo su aplicación por lotes."}</label>
      <button className="button-link" name="intent" value="apply" disabled={pending || dirty || (!shown.approved && !preview?.applicable)}>{shown.approved ? "Continuar lotes pendientes" : "Aplicar importación revisada"}</button>
    </form>}
    {pending && applyingBatches && <button type="button" className="text-link" onClick={() => { stop.current = true; }}>Detener después del lote en curso</button>}
    {shown.progress && shown.progress.length > 0 && <section className="admin-card" aria-live="polite"><h2>Progreso: {shown.nextIndex} de {shown.batchCount} lotes</h2><PagedReview label="Progreso de importación" items={shown.progress.map((batch) => ({ key: String(batch.index), content: <p>Lote {batch.index + 1} confirmado: {batch.result.created} nuevos, {batch.result.updated} actualizados, {batch.result.protectedCount} protegidos, {batch.result.skipped} omitidos.</p> }))} /></section>}
    {shown.message && <p role={shown.ok ? "status" : "alert"} className={shown.ok ? "form-success" : "form-error"}>{shown.message}</p>}
  </section>;
}
