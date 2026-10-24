import { requireCondition } from "./policy";

export type JsonObject = { [key: string]: unknown };
export function object(value: unknown): JsonObject {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), "API_OBJECT");
  return value as JsonObject;
}
export function string(value: unknown): string {
  requireCondition(typeof value === "string" && value.length > 0, "API_STRING");
  return value;
}
export function number(value: unknown): number {
  requireCondition(typeof value === "number" && Number.isFinite(value) && value >= 0, "API_NUMBER");
  return value;
}
export function array(value: unknown): unknown[] {
  requireCondition(Array.isArray(value), "API_ARRAY");
  return value;
}

export function api(base: string, token: string, query = "") {
  return async (path: string, method = "GET", body?: unknown): Promise<unknown> => {
    // Never follow a redirect with credentials; never log provider bodies/errors.
    const response = await fetch(`${base}${path}${query ? (path.includes("?") ? "&" : "?") + query : ""}`, {
      method, redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    requireCondition(response.ok, `API_HTTP_${response.status}`);
    return response.status === 204 ? {} : await response.json();
  };
}

export async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean, timeout = 180_000): Promise<T> {
  const deadline = Date.now() + timeout;
  do {
    const value = await read();
    if (ready(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } while (Date.now() < deadline);
  throw new Error("OPERATION_TIMEOUT");
}
