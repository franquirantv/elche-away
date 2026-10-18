import "server-only";
import { connection } from "next/server";
import { getDatabase } from "./client";
import { readHomeSummary, findTrip, findVisitedStadium, listTrips, listVisitedStadiums } from "./queries";

// Request-time reads only: no build-time DB dependency or persistent data cache.
export async function getTrips(stadiumId?: string) {
  await connection();
  try { return await listTrips(getDatabase(), stadiumId); }
  catch { throw new Error("No se pudo consultar el archivo. Revisa la conexión a PostgreSQL."); }
}

export async function getTrip(slug: string) {
  await connection();
  try { return await findTrip(getDatabase(), slug); }
  catch { throw new Error("No se pudo consultar el viaje."); }
}

export async function getVisitedStadiums() {
  await connection();
  try { return await listVisitedStadiums(getDatabase()); }
  catch { throw new Error("No se pudieron consultar los estadios."); }
}

export async function getVisitedStadium(slug: string) {
  await connection();
  try { return await findVisitedStadium(getDatabase(), slug); }
  catch { throw new Error("No se pudo consultar el estadio."); }
}

export async function getHomeSummary() {
  await connection();
  try { return await readHomeSummary(getDatabase()); }
  catch { throw new Error("No se pudo consultar el resumen del archivo."); }
}
