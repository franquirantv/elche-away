import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../scripts/cd/http";
import { smoke } from "../scripts/cd/smoke";

test("provider API fails closed without reflecting secret-bearing errors or following redirects", async (t) => {
  const secret = "synthetic-never-log-this";
  const fetch = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${secret}`);
    return new Response(secret, { status: 403 });
  });
  await assert.rejects(api("https://api.example", secret)("/resource", "POST", { synthetic: true }), (error: unknown) => {
    assert.ok(error instanceof Error && !error.message.includes(secret) && error.message === "API_HTTP_403");
    return true;
  });
  assert.equal(fetch.mock.callCount(), 1); // No automatic retry of POST.
});

test("production smoke performs only reads and sends bypass only when explicitly supplied", async (t) => {
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL, init?: RequestInit) => {
    paths.push(url.pathname);
    assert.equal(init?.method, undefined);
    assert.equal(init?.redirect, "error");
    assert.deepEqual(init?.headers, {});
    return new Response('<html lang="es"><title>Elche Away</title>Donde tú Viajes Estadios Mapa No encontramos esta página</html>',
      { status: url.pathname.includes("missing") ? 404 : 200 });
  });
  await smoke("https://synthetic.example");
  assert.deepEqual(paths, ["/", "/trips", "/stadiums", "/map", "/__cd_missing_page__"]);
});

test("HTTP 200 with the real archive error boundary fails smoke and stops before later pages", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(
    '<html lang="es"><title>Elche Away</title><h1>No podemos cargar esta página</h1></html>', { status: 200 }));
  await assert.rejects(smoke("https://synthetic.example"), /SMOKE_FAILED/);
  assert.equal(fetch.mock.callCount(), 3);
});
