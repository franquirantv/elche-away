import { createHmac, timingSafeEqual } from "node:crypto";
import { ImportError } from "./import-input";
import type { GlobalPlan } from "./global-import-types";
export function signGlobalPlan(plan: GlobalPlan, key: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ plan, expires: now + 30 * 60_000 })).toString("base64url");
  const token = `${body}.${createHmac("sha256", key).update(`global-import-v1:${body}`).digest("base64url")}`;
  if (token.length > 750_000) throw new ImportError("El rango genera un preview demasiado grande. Selecciona un rango menor.");
  return token;
}
export function verifyGlobalPlan(token: string, key: string, now = Date.now()): GlobalPlan {
  if (token.length > 750_000) throw new ImportError("Preview global no válido.");
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new ImportError("Preview global no válido.");
  const expected = createHmac("sha256", key).update(`global-import-v1:${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ImportError("El preview global ha sido modificado.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { plan: GlobalPlan; expires: number };
  if (!data.plan || !Number.isFinite(data.expires) || data.expires < now) throw new ImportError("El preview global ha caducado. Comprueba de nuevo los datos; los lotes ya aplicados se conservarán.");
  return data.plan;
}
