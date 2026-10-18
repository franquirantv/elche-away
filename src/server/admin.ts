import "server-only";
import { getDatabase } from "@/db/client";
import { readReferences } from "@/db/references";
import { requireAdmin } from "./auth";

export async function getAdminReferences() {
  await requireAdmin();
  try { return await readReferences(getDatabase()); }
  catch { throw new Error("No se pudieron cargar las referencias."); }
}
