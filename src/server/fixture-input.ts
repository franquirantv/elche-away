import { InvalidReference, validId, type ReferenceValues } from "./reference-input";
import { validateMatch } from "../db/validation";
import type { matches } from "../db/schema";

export const fixtureStatuses = { unknown: "Desconocido", scheduled: "Programado", postponed: "Aplazado", finished: "Finalizado", cancelled: "Cancelado", abandoned: "Abandonado" } as const;
export function readFixtureInput(form: FormData): ReferenceValues {
  const values: ReferenceValues = {};
  for (const field of ["id", "intent", "homeClubId", "awayClubId", "homeScore", "awayScore", "playedOn", "seasonId", "competitionId", "stadiumId", "phase", "status", "factualNotes", "notes", "isSpecial", "confirmDelete", "confirmDuplicate"]) {
    const value = form.get(field);
    if (value !== null && typeof value !== "string") throw new InvalidReference({ [field]: "Formato no válido." });
    values[field] = (value ?? "").trim();
  }
  return values;
}
export function fixtureFacts(v: ReferenceValues): typeof matches.$inferInsert {
  const errors: Record<string, string> = {};
  for (const field of ["homeClubId", "awayClubId", "seasonId", "competitionId", "stadiumId"]) {
    if (v[field]) { try { validId(v[field]); } catch { errors[field] = "Selecciona una referencia válida."; } }
  }
  if (v.playedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(v.playedOn) || !Number.isFinite(Date.parse(v.playedOn)) || new Date(v.playedOn).toISOString().slice(0, 10) !== v.playedOn || v.playedOn.startsWith("0000"))) errors.playedOn = "Introduce una fecha exacta válida o déjala vacía.";
  for (const field of ["homeScore", "awayScore"]) if (v[field] && (!/^\d+$/.test(v[field]) || Number(v[field]) > 2147483647)) errors[field] = "Introduce un entero no negativo o deja ambos goles vacíos.";
  if (!Object.hasOwn(fixtureStatuses, v.status)) errors.status = "Selecciona un estado válido.";
  if (v.phase.length > 200) errors.phase = "Máximo 200 caracteres.";
  if (v.factualNotes.length > 10000) errors.factualNotes = "Máximo 10000 caracteres.";
  if (Object.keys(errors).length) throw new InvalidReference(errors);
  const facts = {
    homeClubId: v.homeClubId || null, awayClubId: v.awayClubId || null,
    homeScore: v.homeScore ? Number(v.homeScore) : null, awayScore: v.awayScore ? Number(v.awayScore) : null,
    playedOn: v.playedOn || null, seasonId: v.seasonId || null, competitionId: v.competitionId || null,
    stadiumId: v.stadiumId || null, phase: v.phase || null, factualNotes: v.factualNotes || null,
    status: v.status as keyof typeof fixtureStatuses, factsLocked: true,
  };
  try { validateMatch(facts); } catch { throw new InvalidReference({ homeClubId: "Asigna Elche exactamente a un lado, o deja ambos clubes y goles desconocidos. Los goles deben estar ambos completos o ambos vacíos." }); }
  return facts;
}
