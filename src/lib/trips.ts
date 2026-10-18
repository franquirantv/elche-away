import type { PublicTrip } from "../db/queries";

export function tripTitle(trip: Pick<PublicTrip, "homeName" | "awayName">) {
  if (!trip.homeName && !trip.awayName) return "Partido sin identificar";
  return `${trip.homeName ?? "Club desconocido"} — ${trip.awayName ?? "Club desconocido"}`;
}

export function tripScore(trip: Pick<PublicTrip, "status" | "homeScore" | "awayScore">) {
  return trip.status === "finished" && trip.homeScore !== null && trip.awayScore !== null
    ? `${trip.homeScore} – ${trip.awayScore}` : "Resultado desconocido";
}

export function matchDate(value: string | null) {
  if (!value) return "Fecha desconocida";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export const statusLabels = {
  unknown: "Estado desconocido", scheduled: "Programado", postponed: "Aplazado", finished: "Finalizado", cancelled: "Cancelado", abandoned: "Suspendido sin finalizar",
};
