import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";

// Synthetic upstream for automated SDK/session/authorization tests only.
// The app has no test-login route, bypass token or automatic enrollment.
export async function authFixture() {
  const ownerId = "synthetic-owner";
  const ownerToken = randomBytes(32).toString("hex");
  const otherToken = randomBytes(32).toString("hex");
  const sessions = new Map([[ownerToken, ownerId], [otherToken, "synthetic-other-user"]]);
  let unavailable = false;
  let renewOwnerCookies = false;
  let ownerAge = 0;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    if (unavailable) { response.writeHead(503); response.end(JSON.stringify({ message: "Synthetic outage" })); return; }
    let token = request.headers.cookie?.match(/__Secure-neon-auth\.session_token=([^;]+)/)?.[1];
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/auth/get-session") {
      const verifier = url.searchParams.get("neon_auth_session_verifier");
      if (verifier) {
        if (verifier !== "synthetic-verifier" || !request.headers.cookie?.includes("__Secure-neon-auth.session_challenge=synthetic-challenge")) {
          response.writeHead(401); response.end("null"); return;
        }
        token = otherToken;
        response.setHeader("Set-Cookie", `__Secure-neon-auth.session_token=${otherToken}; Path=/; HttpOnly; Secure; SameSite=Lax`);
      }
      const userId = token ? sessions.get(token) : undefined;
      if (!userId) { response.end("null"); return; }
      const now = new Date().toISOString();
      if (userId === ownerId && renewOwnerCookies && url.searchParams.get("disableRefresh") !== "true") {
        response.setHeader("Set-Cookie", `__Secure-neon-auth.session_token=${ownerToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
      }
      response.end(JSON.stringify({
        user: { id: userId, name: "Synthetic user", email: `${userId}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now, image: null },
        session: { id: `session-${userId}`, userId, token, expiresAt: new Date(Date.now() + 604800000 - (userId === ownerId ? ownerAge : 0)).toISOString(), createdAt: new Date(Date.now() - (userId === ownerId ? ownerAge : 0)).toISOString(), updatedAt: now, ipAddress: null, userAgent: null },
      }));
    } else if (url.pathname === "/auth/sign-out") {
      if (token) sessions.delete(token);
      response.setHeader("Set-Cookie", "__Secure-neon-auth.session_token=; Path=/; HttpOnly; Secure; Max-Age=0");
      response.end(JSON.stringify({ success: true }));
    } else { response.writeHead(404); response.end("null"); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture port");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/auth`, ownerId,
    ownerCookie: `__Secure-neon-auth.session_token=${ownerToken}`,
    otherCookie: `__Secure-neon-auth.session_token=${otherToken}`,
    revokeOwner: () => sessions.delete(ownerToken),
    restoreOwner: () => sessions.set(ownerToken, ownerId),
    renewOwnerCookies: (value: boolean) => { renewOwnerCookies = value; },
    ownerAge: (milliseconds: number) => { ownerAge = milliseconds; },
    outage: (value: boolean) => { unavailable = value; },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
