import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { AccessDenied, assertAdminIdentity } from "./admin-policy";

let auth: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  if (auth) return auth;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) throw new Error("Configura Neon Auth según README.md.");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Neon Auth requiere una URL HTTPS.");
  }
  auth = createNeonAuth({ baseUrl, cookies: { secret }, logLevel: "silent" });
  return auth;
}

export async function getVerifiedSession() {
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) throw new AccessDenied();
    if (!data?.session || !data.user) return null;
    const expiresAt = new Date(data.session.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return data;
  } catch { throw new AccessDenied(); }
}

export async function requireAdmin() {
  const session = await getVerifiedSession();
  assertAdminIdentity(session?.user?.id, process.env.ADMIN_USER_ID);
  return session!.user;
}
