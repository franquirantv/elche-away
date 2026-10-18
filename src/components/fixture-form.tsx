"use client";
import { useActionState, useId } from "react";
import { mutateFixture } from "@/app/admin/fixture-actions";
import { fixtureStatuses } from "@/server/fixture-input";
import type { ReferenceState } from "@/server/reference-input";
import type { matches, attendance } from "@/db/schema";

type Options = { clubs: { id: string; name: string }[]; stadiums: { id: string; name: string }[]; competitions: { id: string; name: string }[]; seasons: { id: string; label: string }[] };
export function FixtureForm({ record, personal, options, attendanceOnly = false }: {
  record?: typeof matches.$inferSelect; personal?: typeof attendance.$inferSelect | null; options: Options; attendanceOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(mutateFixture, { ok: false, message: "" } satisfies ReferenceState);
  const prefix = useId();
  const initial: Record<string, string> = record ? Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? "")])) : { status: "unknown" };
  initial.notes = personal?.notes ?? "";
  initial.isSpecial = personal?.isSpecial ? "yes" : "";
  const value = (name: string) => state.values?.[name] ?? initial[name] ?? "";
  const error = (name: string) => state.errors?.[name] && <span id={`${prefix}-${name}-error`} className="form-error">{state.errors[name]}</span>;
  const input = (name: string, label: string, type = "text", maxLength = 200) => <label className="admin-field" htmlFor={`${prefix}-${name}`}><span>{label}</span><input id={`${prefix}-${name}`} name={name} type={type} defaultValue={value(name)} maxLength={maxLength} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} aria-invalid={Boolean(state.errors?.[name])} aria-describedby={state.errors?.[name] ? `${prefix}-${name}-error` : undefined} />{error(name)}</label>;
  const select = (name: string, label: string, choices: { id: string; name: string }[]) => <label className="admin-field" htmlFor={`${prefix}-${name}`}><span>{label}</span><select id={`${prefix}-${name}`} name={name} defaultValue={value(name)} aria-invalid={Boolean(state.errors?.[name])}><option value="">Desconocido</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select>{error(name)}</label>;
  const textarea = (name: string, label: string) => <label className="admin-field" htmlFor={`${prefix}-${name}`}><span>{label}</span><textarea id={`${prefix}-${name}`} name={name} defaultValue={value(name)} maxLength={10000} rows={4} aria-invalid={Boolean(state.errors?.[name])} />{error(name)}</label>;
  // Remount form controls when returned values change so native form resets
  // also retain submitted select/checkbox defaults after validation failures.
  return <form key={JSON.stringify(state.values ?? initial)} action={action} className="reference-form">
    <input type="hidden" name="id" value={record?.id ?? ""} />
    {attendanceOnly ? <>
      <p className="admin-hint">Guardar publica este viaje inmediatamente. Las notas son públicas. Desmarcar elimina notas, distinción y enlace público; conserva el partido.</p>
      {personal && <p>Enlace estable: <code>{personal.slug}</code></p>}
      {textarea("notes", "Recuerdos del viaje (públicos, opcional)")}
      <label><input type="checkbox" name="isSpecial" value="yes" defaultChecked={value("isSpecial") === "yes"} /> Un partido especial</label>
      <button className="button-link" name="intent" value="attend" disabled={pending}>{personal ? "Guardar asistencia" : "Asistí a este partido"}</button>
      {personal && <div className="delete-controls"><label><input type="checkbox" name="confirmDelete" value="yes" /> Confirmo que quiero eliminar la asistencia y sus notas públicas</label><button className="delete-button" name="intent" value="unattend" disabled={pending}>Desmarcar asistencia</button></div>}
    </> : <>
      <p className="admin-hint">Todos los datos históricos pueden quedar desconocidos. Para designación desconocida, deja ambos clubes y ambos goles vacíos: se pierde su orientación; conserva el conocimiento parcial en las anotaciones factuales. El estadio no determina quién juega en casa.</p>
      {select("homeClubId", "Club local", options.clubs)}{select("awayClubId", "Club visitante", options.clubs)}
      {input("homeScore", "Goles del local (opcional)", "number")}{input("awayScore", "Goles del visitante (opcional)", "number")}
      {input("playedOn", "Fecha exacta (opcional)", "date")}
      {select("seasonId", "Temporada", options.seasons.map((season) => ({ id: season.id, name: season.label })))}
      {select("competitionId", "Competición", options.competitions)}{select("stadiumId", "Estadio", options.stadiums)}
      {input("phase", "Fase (opcional)")}
      <label className="admin-field" htmlFor={`${prefix}-status`}><span>Estado</span><select id={`${prefix}-status`} name="status" defaultValue={value("status")}>{Object.entries(fixtureStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{error("status")}</label>
      {textarea("factualNotes", "Anotaciones factuales (públicas si hay asistencia; sin recuerdos personales)")}
      <p className="admin-hint">Guardar crea o bloquea todos los datos del partido frente a futuras importaciones. No modifica la asistencia ni su enlace.</p>
      <label><input type="checkbox" name="confirmDuplicate" value="yes" defaultChecked={value("confirmDuplicate") === "yes"} /> He revisado los posibles duplicados y confirmo que es otro partido</label>{error("confirmDuplicate")}
      <button className="button-link" name="intent" value="save" disabled={pending}>{record ? "Guardar partido" : "Crear partido"}</button>
      {record && <div className="delete-controls"><label><input type="checkbox" name="confirmDelete" value="yes" /> Confirmo que quiero eliminar este partido sin asistencia</label><button className="delete-button" name="intent" value="delete" formNoValidate disabled={pending}>Eliminar partido</button></div>}
    </>}
    {pending && <p role="status">Procesando…</p>}
    {state.message && <div role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}><p>{state.message}</p>{["id", "intent", "confirmDelete", "isSpecial"].map((name) => <div key={name}>{error(name)}</div>)}</div>}
  </form>;
}
