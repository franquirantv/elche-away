"use client";

import { useActionState, useId } from "react";
import { mutateReference } from "@/app/admin/actions";
import { provinces } from "@/lib/geography";
import type { ReferenceKind, ReferenceState } from "@/server/reference-input";

type ReferenceRecord = {
  id: string; name?: string; label?: string; slug?: string; crestPath?: string | null;
  city?: string | null; provinceCode?: string | null; latitude?: number | null; longitude?: number | null;
  level?: number; startYear?: number; elcheTierId?: string | null;
};

export function ReferenceForm({ kind, record, tierOptions, protectedClub = false }: {
  kind: ReferenceKind; record?: ReferenceRecord; tierOptions: { id: string; name: string }[]; protectedClub?: boolean;
}) {
  const [state, action, pending] = useActionState(mutateReference, { ok: false, message: "" } satisfies ReferenceState);
  const prefix = useId();
  const field = (name: keyof ReferenceRecord) => state.values?.[name] ?? String(record?.[name] ?? "");
  function input(name: keyof ReferenceRecord, label: string, type = "text", required = false) {
    return <label className="admin-field" key={name} htmlFor={`${prefix}-${name}`}>
      <span>{label}</span><input id={`${prefix}-${name}`} name={name} type={type} required={required} maxLength={type === "text" ? 200 : undefined} step={type === "number" ? "any" : undefined} defaultValue={field(name)} aria-invalid={Boolean(state.errors?.[name])} aria-describedby={state.errors?.[name] ? `${prefix}-${name}-error` : undefined} />
      {state.errors?.[name] && <span className="form-error" id={`${prefix}-${name}-error`}>{state.errors[name]}</span>}
    </label>;
  }
  return <form action={action} className="reference-form">
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={record?.id ?? ""} />
    {kind === "seasons" ? <>{input("label", "Temporada", "text", true)}{input("startYear", "Año de inicio", "number", true)}
      <label className="admin-field" htmlFor={`${prefix}-tier`}><span>División del Elche (opcional)</span><select id={`${prefix}-tier`} name="elcheTierId" defaultValue={field("elcheTierId")} aria-invalid={Boolean(state.errors?.elcheTierId)}><option value="">Desconocida</option>{tierOptions.map((tier) => <option value={tier.id} key={tier.id}>{tier.name}</option>)}</select>{state.errors?.elcheTierId && <span className="form-error">{state.errors.elcheTierId}</span>}</label>
    </> : input("name", "Nombre", "text", true)}
    {kind === "tiers" && input("level", "Nivel en la pirámide", "number", true)}
    {kind === "clubs" && input("crestPath", "Escudo local (opcional): /crests/archivo.webp")}
    {kind === "stadiums" && <>
      {input("city", "Ciudad (opcional)")}
      <label className="admin-field" htmlFor={`${prefix}-province`}><span>Provincia (opcional)</span><select id={`${prefix}-province`} name="provinceCode" defaultValue={field("provinceCode")} aria-invalid={Boolean(state.errors?.provinceCode)}><option value="">Desconocida</option>{Object.entries(provinces).sort((a, b) => a[1].name.localeCompare(b[1].name, "es")).map(([code, province]) => <option key={code} value={code}>{province.name}</option>)}</select>{state.errors?.provinceCode && <span className="form-error">{state.errors.provinceCode}</span>}</label>
      {input("latitude", "Latitud (opcional)", "number")}{input("longitude", "Longitud (opcional)", "number")}
    </>}
    {record?.slug && <p className="admin-hint">Enlace estable: <code>{record.slug}</code>. Cambiar el nombre no modifica el enlace.</p>}
    <div className="form-actions"><button name="intent" value="save" className="button-link" disabled={pending}>{pending ? "Procesando…" : record ? "Guardar cambios" : "Crear referencia"}</button>
      {record && !protectedClub && <div className="delete-controls"><label><input type="checkbox" name="confirmDelete" value="yes" /> Confirmo que quiero eliminar esta referencia</label><button name="intent" value="delete" className="delete-button" formNoValidate disabled={pending}>Eliminar</button></div>}
    </div>
    {protectedClub && <p className="admin-hint">Elche CF es el club de referencia y no se puede eliminar.</p>}
    {state.message && <div role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}><p>{state.message}</p>{state.errors && <ul>{Object.entries(state.errors).filter(([name]) => ["confirmDelete", "id", "kind", "intent"].includes(name)).map(([name, error]) => <li key={name}>{error}</li>)}</ul>}</div>}
  </form>;
}
