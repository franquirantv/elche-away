import "server-only";
import { getDatabase } from "@/db/client";
import { readReferences } from "@/db/references";
import type { ReferenceKind } from "./reference-input";
import { requireAdmin } from "./auth";

export async function getAdminReferences(window?: { kind: ReferenceKind; page: number }) {
  await requireAdmin();
  try { return await readReferences(getDatabase(), window); }
  catch { throw new Error("No se pudieron cargar las referencias."); }
}
