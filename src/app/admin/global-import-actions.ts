"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { AccessDenied } from "@/server/admin-policy";
import { ImportError } from "@/server/import-input";
import { obtainOpenFootball } from "@/server/openfootball";
import { signGlobalPlan, verifyGlobalPlan } from "@/server/global-review";
import { getDatabase } from "@/db/client";
import { applyGlobalBatch, globalBatches, globalProgress, newGlobalPlan, previewGlobalImport, resumeGlobalImport } from "@/db/global-import";
import type { GlobalImportState, GlobalPlan, GlobalPreview } from "@/server/global-import-types";
function value(form: FormData, name: string) {
  const field = form.get(name);
  if (typeof field !== "string") throw new ImportError(`Campo no válido: ${name}.`);
  return field;
}
function key() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new ImportError("Falta configuración segura del servidor.");
  return secret;
}
async function response(plan: GlobalPlan, message: string, preview?: GlobalPreview): Promise<GlobalImportState> {
  const { files: _files, ...acquisition } = plan.acquisition;
  void _files;
  return { ok: true, message, token: signGlobalPlan(plan, key()), acquisition, preview, progress: await globalProgress(getDatabase(), plan), nextIndex: plan.batchIndex, batchCount: globalBatches(plan).length, approved: plan.approved };
}
export async function directImport(form: FormData): Promise<GlobalImportState> {
  try {
    await requireAdmin(); // Authorize BEFORE parsing, GitHub access or database reads.
    const intent = value(form, "intent");
    if (intent === "check") {
      const acquisition = await obtainOpenFootball(Number(value(form, "startYear")), Number(value(form, "endYear")));
      const plan = await newGlobalPlan(getDatabase(), acquisition, form.get("resultsConfirmed") === "yes");
      const preview = await previewGlobalImport(getDatabase(), plan);
      return response(plan, "Comprobación finalizada. Revisa la cobertura, las referencias propuestas y TODOS los partidos antes de confirmar. No se ha escrito ningún dato.", preview);
    }
    const plan = verifyGlobalPlan(value(form, "token"), key());
    if (intent === "preview" || intent === "new-pending" || intent === "skip-pending") {
      if (plan.approved) throw new ImportError("La importación ya se inició. Reanúdala o comprueba de nuevo los datos.");
      plan.resultsConfirmed = form.get("resultsConfirmed") === "yes";
      let changedReferences = false;
      plan.references = plan.references.map((ref, i) => {
        const choice = value(form, `ref-${i}`);
        if (choice !== "new" && choice !== "" && !/^[a-f0-9-]{36}$/.test(choice)) throw new ImportError("Referencia no válida.");
        if (ref.choice !== choice) changedReferences = true;
        return { ...ref, choice };
      });
      // A changed mapping can change candidate identity; do not carry forward
      // old default-new proposals silently after remapping references.
      plan.targets = changedReferences ? {} : Object.fromEntries(Object.keys(plan.targets).map((id) => [id, plan.targets[id]]));
      for (const [name, target] of form.entries()) if (!changedReferences && name.startsWith("target-") && typeof target === "string") {
        const id = name.slice(7);
        if (!/^[a-f0-9]{64}$/.test(id) || (target && !["new", "skip"].includes(target) && !/^[a-f0-9-]{36}$/.test(target))) throw new ImportError("Decisión de partido no válida.");
        plan.targets[id] = target;
      }
      let preview = await previewGlobalImport(getDatabase(), plan);
      if (intent !== "preview") {
        for (const batch of preview.batches) for (const row of batch.rows) if (!row.target) plan.targets[row.sourceId] = intent === "new-pending" ? "new" : "skip";
        preview = await previewGlobalImport(getDatabase(), plan);
      }
      return response(plan, "Preview global actualizado; aún no se ha guardado ningún dato.", preview);
    }
    if (intent === "resume") {
      const resumed = await resumeGlobalImport(getDatabase(), plan);
      return response(resumed, "Estado recuperado. Pulsa continuar para reanudar explícitamente los lotes pendientes.", resumed.approved ? undefined : await previewGlobalImport(getDatabase(), resumed));
    }
    if (intent !== "apply") throw new ImportError("Acción de importación directa no válida.");
    const { next, outcome } = await getDatabase().transaction((tx) => applyGlobalBatch(tx, plan, form.get("confirmGlobal") === "yes"));
    revalidatePath("/admin"); revalidatePath("/trips", "layout"); revalidatePath("/stadiums", "layout");
    return response(next, `Lote ${outcome.index + 1} ${outcome.replayed ? "ya aplicado; se conserva su resultado" : "aplicado"}: ${outcome.result.created} nuevos, ${outcome.result.updated} actualizados, ${outcome.result.protectedCount} protegidos y ${outcome.result.skipped} omitidos.`);
  } catch (error) {
    if (error instanceof ImportError || error instanceof AccessDenied) return { ok: false, message: error.message };
    return { ok: false, message: "No se pudo completar o confirmar la operación. Los lotes confirmados se conservan. Recupera el estado y reanuda explícitamente: los recibos impiden repetir un lote si se perdió su respuesta." };
  }
}
