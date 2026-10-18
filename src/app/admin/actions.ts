"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { AccessDenied } from "@/server/admin-policy";
import { InvalidReference, readReferenceInput, referenceKind, type ReferenceState, type ReferenceValues } from "@/server/reference-input";
import { getDatabase } from "@/db/client";
import { writeReference } from "@/db/references";

export async function mutateReference(_previous: ReferenceState, form: FormData): Promise<ReferenceState> {
  let values: ReferenceValues | undefined;
  try {
    // Never trust a user ID, email or role from form data, headers or the client.
    await requireAdmin();
    values = readReferenceInput(form);
    await writeReference(getDatabase(), referenceKind(values.kind), values);
    revalidatePath("/admin");
    revalidatePath("/map");
    revalidatePath("/trips", "layout");
    revalidatePath("/stadiums", "layout");
    return { ok: true, message: values.intent === "delete" ? "Referencia eliminada." : "Referencia guardada." };
  } catch (error) {
    if (error instanceof AccessDenied) return { ok: false, message: error.message };
    if (error instanceof InvalidReference) return { ok: false, message: error.message, errors: error.errors, values };
    const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
    if (["23001", "23503"].includes(code ?? "")) return { ok: false, message: "No se puede completar la operación: la referencia está en uso o la referencia seleccionada ya no existe.", values };
    if (code === "23505") return { ok: false, message: "Ya existe una referencia con ese identificador o temporada. Revisa los datos.", values };
    return { ok: false, message: "No se pudo guardar el cambio. Vuelve a intentarlo.", values };
  }
}
