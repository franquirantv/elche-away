"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { AccessDenied } from "@/server/admin-policy";
import { getDatabase } from "@/db/client";
import { applyFixtureImport, previewFixtureImport } from "@/db/fixture-import";
import { decodeImportInput, digest, ImportError, MAX_IMPORT_BYTES, selectedRecords } from "@/server/import-input";
import { signImportReview, verifyImportReview } from "@/server/import-review";
import type { ImportState } from "@/server/import-types";
import { InvalidReference } from "@/server/reference-input";

function field(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string") throw new ImportError(`Campo no válido: ${name}.`);
  return value;
}
function reviewKey() {
  const key = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!key || key.length < 32) throw new ImportError("Falta configuración segura del servidor.");
  return key;
}
// Every request, including parsing/uploads and apply retries, reauthorizes before
// reading user input or accessing PostgreSQL. No external fetch exists here.
export async function importFixtures(form: FormData): Promise<ImportState> {
  try {
    await requireAdmin();
    const intent = field(form, "intent");
    if (intent === "apply") {
      if (form.get("confirmApply") !== "yes") throw new ImportError("Confirma expresamente el lote revisado.");
      const { input, snapshot } = verifyImportReview(field(form, "token"), reviewKey());
      const result = await getDatabase().transaction((tx) => applyFixtureImport(tx, input, snapshot));
      revalidatePath("/admin"); revalidatePath("/trips", "layout"); revalidatePath("/stadiums", "layout");
      return { ok: true, message: `Lote aplicado: ${result.created} nuevos, ${result.updated} actualizados, ${result.protectedCount} protegidos y ${result.skipped} omitidos. Los demás no tenían cambios. Para continuar o reimportar, carga el archivo y genera otro preview.` };
    }
    if (intent !== "inspect" && intent !== "preview") throw new ImportError("Acción de importación no válida.");
    let input;
    if (intent === "inspect") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size > MAX_IMPORT_BYTES || file.size === 0) throw new ImportError("Selecciona un archivo de hasta 350000 bytes.");
      input = decodeImportInput({ repository: field(form, "repository"), path: field(form, "path"), revision: field(form, "revision"), content: await file.text(), format: field(form, "format"), seasonId: field(form, "seasonId"), competitionId: field(form, "competitionId"), elcheName: field(form, "elcheName"), offset: Number(field(form, "offset")), resultsConfirmed: form.get("resultsConfirmed") === "yes", mappings: {}, targets: {} });
    } else {
      let payload: unknown;
      try { payload = JSON.parse(field(form, "input")); } catch { throw new ImportError("Entrada de importación no válida."); }
      input = decodeImportInput(payload);
    }
    const batch = selectedRecords(input);
    const names = [...new Set(batch.records.flatMap((r) => [r.home, r.away]))].sort();
    if (intent === "inspect") return { ok: true, message: "Archivo leído sin guardar datos. Asigna los clubes y genera el preview.", input, names };
    input.mappings = Object.fromEntries(names.map((name, i) => [name, field(form, `club-${i}`)]));
    // Keep decisions keyed by record version, never a permanent fixture identity.
    input.targets = Object.fromEntries(batch.records.map((record, i) => [digest(record), String(form.get(`target-${i}`) ?? "")]));
    const preview = await previewFixtureImport(getDatabase(), input);
    return { ok: true, message: "Preview generado. No se ha guardado ningún cambio.", input, names, preview, token: signImportReview(input, preview.snapshot, reviewKey()) };
  } catch (error) {
    if (error instanceof AccessDenied || error instanceof ImportError) return { ok: false, message: error.message };
    if (error instanceof InvalidReference) return { ok: false, message: "Referencia no válida. Vuelve a generar el preview." };
    return { ok: false, message: "No se pudo completar la importación. El lote no se ha aplicado; revisa el archivo y vuelve a generar el preview." };
  }
}
