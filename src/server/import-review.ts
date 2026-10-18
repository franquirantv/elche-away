import { createHmac, timingSafeEqual } from "node:crypto";
import { decodeImportInput, ImportError, type ImportInput } from "./import-input";

// The caller supplies a server-only key. Domain separation prevents reuse of
// signatures as authentication cookies; no new credential is provisioned.
export function signImportReview(input: ImportInput, snapshot: string, key: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ input, snapshot, expires: now + 30 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", key).update(`fixture-import-v1:${body}`).digest("base64url");
  const token = `${body}.${signature}`;
  if (token.length > 750_000) throw new ImportError("El archivo produce un preview demasiado grande. Usa un archivo más pequeño o sin espacios de formato y vuelve a revisarlo.");
  return token;
}
export function verifyImportReview(token: string, key: string, now = Date.now()) {
  if (token.length > 750_000) throw new ImportError("Preview no válido.");
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new ImportError("Preview no válido.");
  const expected = createHmac("sha256", key).update(`fixture-import-v1:${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw new ImportError("El preview ha sido modificado. Genéralo de nuevo.");
  let data: unknown;
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new ImportError("Preview no válido."); }
  if (!data || typeof data !== "object" || !("expires" in data) || typeof data.expires !== "number" || data.expires < now || !("snapshot" in data) || typeof data.snapshot !== "string" || !/^[a-f0-9]{64}$/.test(data.snapshot) || !("input" in data)) throw new ImportError("El preview ha caducado o no es válido. Genéralo de nuevo.");
  return { input: decodeImportInput(data.input), snapshot: data.snapshot };
}
