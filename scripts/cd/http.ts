import { CdError, requireCondition } from "./policy";

const providers = ["github", "neon", "vercel"] as const;
const operations = ["ci.read", "main.read", "project.read", "deployments.list", "deployment.create",
  "deployment.read", "deployment.status", "deployment.statuses", "branches.list", "branch.read",
  "branch.create", "branch.delete", "endpoints.list", "alias.read"] as const;
type Provider = typeof providers[number];
type Operation = typeof operations[number];
export type ApiContext = { provider: Provider; operation: Operation };

export class ApiError extends CdError {
  constructor(code: string, readonly context: ApiContext) {
    super(code);
    requireCondition(/^API_(HTTP_[1-5][0-9]{2}|NETWORK|TIMEOUT|RESPONSE)$/.test(code)
      && providers.includes(context.provider) && operations.includes(context.operation), "API_DIAGNOSTIC_INVALID");
  }
}

// Never format URLs, IDs, error causes or provider response messages.
export function cdFailureMessage(error: unknown) {
  if (error instanceof ApiError) return `${error.message} provider=${error.context.provider} operation=${error.context.operation}`;
  return error instanceof CdError && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "UNCLASSIFIED";
}

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

export function api(provider: Provider, base: string, token: string, query = "") {
  return async (operation: Operation, path: string, method = "GET", body?: unknown): Promise<unknown> => {
    const context = { provider, operation };
    requireCondition(providers.includes(provider) && operations.includes(operation), "API_DIAGNOSTIC_INVALID");
    const signal = AbortSignal.timeout(30_000);
    // Never follow a redirect with credentials; never log provider bodies/errors.
    let response: Response;
    try {
      response = await fetch(`${base}${path}${query ? (path.includes("?") ? "&" : "?") + query : ""}`, {
        method, redirect: "error", signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(signal.aborted || (error instanceof Error && error.name === "TimeoutError") ? "API_TIMEOUT" : "API_NETWORK", context);
    }
    if (!response.ok) throw new ApiError(`API_HTTP_${response.status}`, context);
    try { return response.status === 204 ? {} : await response.json(); }
    catch (error) {
      throw new ApiError(signal.aborted || (error instanceof Error && error.name === "TimeoutError") ? "API_TIMEOUT"
        : error instanceof SyntaxError ? "API_RESPONSE" : "API_NETWORK", context);
    }
  };
}

export async function waitFor<T>(context: ApiContext, read: () => Promise<T>, ready: (value: T) => boolean, timeout = 180_000): Promise<T> {
  const deadline = Date.now() + timeout;
  do {
    const value = await read();
    if (ready(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } while (Date.now() < deadline);
  throw new ApiError("API_TIMEOUT", context);
}
