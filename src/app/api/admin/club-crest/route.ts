import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { AccessDenied } from "@/server/admin-policy";
import { getDatabase } from "@/db/client";
import { cleanupCrests, CrestConflict, removeCrest, replaceCrest } from "@/db/club-crests";
import { crestStore } from "@/server/storage-client";
import { InvalidCrest, normalizeCrest, readCrestForm } from "@/server/crest-input";
import { InvalidReference, validId } from "@/server/reference-input";
import { isCrestKey } from "@/lib/crest-key";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let store: ReturnType<typeof crestStore> | undefined;
  const respond = (message: string, status = 200) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  try {
    await requireAdmin(); // Before parsing files or contacting Storage/PostgreSQL.
    // Next's internal URL may use localhost while the incoming Host is 127.0.0.1.
    // Use the actual request host, not forwarded/client-supplied identity fields.
    const incoming = new URL(request.url);
    const origin = `${incoming.protocol}//${request.headers.get("Host") || incoming.host}`;
    if (request.headers.get("Origin") !== origin) return respond("Origen de la petición no permitido.", 403);
    const form = await readCrestForm(request);
    const intent = form.get("intent");
    if (!["upload", "remove", "cleanup"].includes(String(intent))) throw new InvalidCrest("Acción de escudo no válida.");
    const db = getDatabase();
    if (intent === "cleanup") {
      store = crestStore();
      const result = await cleanupCrests(db, store);
      return respond(`Objetos limpiados: ${result.cleaned}.${result.remaining ? " Quedan objetos pendientes; reintenta más tarde. Las subidas interrumpidas pueden tardar una hora en ser elegibles." : " No quedan objetos pendientes."}`);
    }
    const clubId = validId(String(form.get("clubId") || ""));
    const expected = String(form.get("expectedKey") || "") || null;
    if (expected && (!isCrestKey(expected) || !expected.startsWith(`crests/${clubId}/`))) throw new InvalidCrest("Referencia de escudo no válida.");
    if (intent === "upload") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new InvalidCrest("Selecciona una imagen.");
      const bytes = await normalizeCrest(file);
      store = crestStore();
      await replaceCrest(db, store, clubId, expected, bytes);
    } else {
      if (form.get("confirmRemove") !== "yes") throw new InvalidCrest("Confirma la eliminación del escudo.");
      store = crestStore();
      await removeCrest(db, store, clubId, expected);
    }
    revalidatePath("/admin");
    revalidatePath("/map");
    return respond(intent === "upload" ? "Escudo guardado." : "Escudo eliminado. El club se conserva.");
  } catch (error) {
    if (error instanceof AccessDenied) return respond(error.message, 403);
    if (error instanceof InvalidCrest || error instanceof InvalidReference) return respond(error.message, 400);
    if (error instanceof CrestConflict) return respond(error.message, 409);
    return respond("No se pudo completar la operación. Revisa Storage y reintenta. La limpieza pendiente se puede recuperar sin borrar escudos en uso.", 503);
  } finally { store?.close(); }
}
