import { provinces } from "../lib/geography";

export const referenceKinds = ["clubs", "stadiums", "competitions", "tiers", "seasons"] as const;
export type ReferenceKind = typeof referenceKinds[number];
export type ReferenceValues = Record<string, string>;
export type ReferenceState = { ok: boolean; message: string; values?: ReferenceValues; errors?: Record<string, string> };
export class InvalidReference extends Error {
  constructor(public errors: Record<string, string>) { super("Revisa los campos indicados."); }
}
export function referenceKind(value: unknown): ReferenceKind {
  if (!referenceKinds.includes(value as ReferenceKind)) throw new InvalidReference({ kind: "Referencia desconocida." });
  return value as ReferenceKind;
}
export function validId(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new InvalidReference({ id: "Identificador no válido." });
  return value;
}
export function readReferenceInput(form: FormData) {
  const fields = ["kind", "id", "intent", "name", "crestPath", "city", "provinceCode", "latitude", "longitude", "label", "level", "startYear", "elcheTierId", "confirmDelete"];
  const values: ReferenceValues = {};
  for (const field of fields) {
    const value = form.get(field);
    if (value !== null && typeof value !== "string") throw new InvalidReference({ [field]: "Formato no válido." });
    values[field] = (value ?? "").trim();
  }
  return values;
}

export function validateReference(kind: ReferenceKind, v: ReferenceValues) {
  const errors: Record<string, string> = {};
  const required = kind === "seasons" ? "label" : "name";
  if (!v[required] || v[required].length > 200) errors[required] = "Introduce entre 1 y 200 caracteres.";
  if (kind === "clubs" && v.crestPath && !/^\/crests\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(v.crestPath)) errors.crestPath = "Usa un archivo local de /crests/, sin subcarpetas ni URL externa.";
  if (kind === "stadiums") {
    if (v.city.length > 200) errors.city = "Máximo 200 caracteres.";
    if (v.provinceCode && !provinces[v.provinceCode]) errors.provinceCode = "Selecciona una provincia válida.";
    if (Boolean(v.latitude) !== Boolean(v.longitude)) errors.latitude = "Indica ambas coordenadas o deja ambas vacías.";
    for (const [field, limit] of [["latitude", 90], ["longitude", 180]] as const) {
      if (v[field] && (!Number.isFinite(Number(v[field])) || Math.abs(Number(v[field])) > limit)) errors[field] = `Usa un número entre -${limit} y ${limit}.`;
    }
  }
  if (kind === "tiers" && (!/^\d+$/.test(v.level) || Number(v.level) < 1 || Number(v.level) > 2147483647)) errors.level = "Introduce un nivel entero positivo.";
  if (kind === "seasons") {
    if (!/^\d{4}$/.test(v.startYear)) errors.startYear = "Introduce un año de cuatro cifras.";
    if (v.elcheTierId) {
      try { validId(v.elcheTierId); } catch { errors.elcheTierId = "Selecciona una división válida."; }
    }
  }
  if (Object.keys(errors).length) throw new InvalidReference(errors);
}
