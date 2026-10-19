"use client";

/* eslint-disable @next/next/no-img-element -- Small, server-normalized WebP; no further image transformation needed. */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crestMediaPath } from "@/lib/crest-key";

export function ClubCrestForm({ clubId, objectKey = null }: { clubId?: string; objectKey?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const source = crestMediaPath(objectKey);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(form);
    data.set("intent", submitter?.value || "upload");
    if (submitter?.value !== "upload") data.delete("file");
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/club-crest", { method: "POST", body: data });
      const result: { message: string } = await response.json();
      setMessage(result.message);
      if (response.ok) { form.reset(); router.refresh(); }
    } catch { setMessage("No se pudo completar la petición. Recarga para comprobar el estado antes de reintentar."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="reference-form crest-form" aria-label={clubId ? "Escudo del club" : "Limpieza de escudos"}>
    {clubId ? <>
      <h3>Escudo del club</h3>
      <input type="hidden" name="clubId" value={clubId} /><input type="hidden" name="expectedKey" value={objectKey || ""} />
      {source && !failed ? <img src={source} alt="Escudo actual del club" width={64} height={64} className="club-crest-preview" onError={() => setFailed(true)} /> : <p className="admin-hint">Sin escudo disponible. El mapa conserva el badge neutro.</p>}
      <label className="admin-field"><span>PNG, JPEG o WebP de hasta 1 MB</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp" disabled={pending} /></label>
      <p className="admin-hint">Se publica una copia WebP sin metadatos. No se admiten SVG ni imágenes animadas.</p>
      <div className="form-actions"><button type="submit" name="intent" value="upload" className="button-link" disabled={pending}>{objectKey ? "Reemplazar escudo" : "Subir escudo"}</button>
      {objectKey && <div className="delete-controls"><label><input type="checkbox" name="confirmRemove" value="yes" /> Confirmo que quiero eliminar el escudo</label><button type="submit" name="intent" value="remove" className="delete-button" disabled={pending}>Eliminar escudo</button></div>}</div>
    </> : <><button type="submit" name="intent" value="cleanup" className="delete-button" disabled={pending}>Limpiar escudos pendientes</button><p className="admin-hint">Reintenta la limpieza de reemplazos, eliminaciones o subidas interrumpidas. Conserva siempre los escudos en uso.</p></>}
    {pending && <p role="status">Procesando…</p>}{message && <p role="status" className="admin-hint">{message}</p>}
  </form>;
}
