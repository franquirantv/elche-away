"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { AccessDenied } from "@/server/admin-policy";
import { InvalidReference, type ReferenceState, type ReferenceValues } from "@/server/reference-input";
import { readFixtureInput } from "@/server/fixture-input";
import { getDatabase } from "@/db/client";
import { writeFixture } from "@/db/admin-fixtures";

export async function mutateFixture(_previous: ReferenceState, form: FormData): Promise<ReferenceState> {
  let values: ReferenceValues | undefined;
  try {
    await requireAdmin();
    values = readFixtureInput(form);
    await getDatabase().transaction((tx) => writeFixture(tx, values!));
    revalidatePath("/admin");
    revalidatePath("/map");
    revalidatePath("/trips", "layout");
    revalidatePath("/stadiums", "layout");
    const messages: Record<string, string> = { save: "Partido guardado. Datos locales bloqueados.", attend: "Asistencia guardada y publicada.", unattend: "Asistencia eliminada. El partido se conserva.", delete: "Partido eliminado." };
    return { ok: true, message: messages[values.intent] };
  } catch (error) {
    if (error instanceof AccessDenied) return { ok: false, message: error.message };
    if (error instanceof InvalidReference) return { ok: false, message: error.message, errors: error.errors, values };
    const failure = error as { code?: string; cause?: { code?: string } };
    if (["23001", "23503"].includes(failure.cause?.code ?? failure.code ?? "")) return { ok: false, message: "El partido está en uso o una referencia seleccionada ya no existe.", values };
    return { ok: false, message: "No se pudo guardar el cambio. Vuelve a intentarlo.", values };
  }
}
