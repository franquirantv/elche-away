import assert from "node:assert/strict";
import { test } from "node:test";
import { api, cdFailureMessage, waitFor } from "../scripts/cd/http";
import { smoke } from "../scripts/cd/smoke";

test("provider API fails closed without reflecting secret-bearing errors or following redirects", async (t) => {
  const secret = "synthetic-never-log-this";
  const fetch = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${secret}`);
    return new Response(secret, { status: 403 });
  });
  await assert.rejects(api("vercel", "https://api.example", secret)("deployment.create", "/resource-private-id", "POST", { synthetic: true }), (error: unknown) => {
    assert.ok(error instanceof Error && !error.message.includes(secret) && error.message === "API_HTTP_403");
    assert.equal(cdFailureMessage(error), "API_HTTP_403 provider=vercel operation=deployment.create");
    return true;
  });
  assert.equal(fetch.mock.callCount(), 1); // No automatic retry of POST.
});

test("network and timeout diagnostics preserve only static provider/operation and never retry mutations", async (t) => {
  for (const [name, code] of [["TypeError", "API_NETWORK"], ["TimeoutError", "API_TIMEOUT"]]) {
    const failure = new Error("https://sensitive.example/private-id?token=synthetic-secret");
    failure.name = name;
    const fetch = t.mock.method(globalThis, "fetch", async () => { throw failure; });
    await assert.rejects(api("neon", "https://sensitive.example", "synthetic-secret")("branch.create", "/private-id", "POST"),
      (error: unknown) => {
        assert.equal(cdFailureMessage(error), `${code} provider=neon operation=branch.create`);
        return true;
      });
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
  assert.equal(cdFailureMessage(new Error("synthetic-secret")), "UNCLASSIFIED");
});

test("polling timeouts and invalid response bodies retain safe API context", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => { callback(); return 0; });
  await assert.rejects(waitFor({ provider: "vercel", operation: "deployment.read" }, async () => false, Boolean, 0),
    (error: unknown) => {
      assert.equal(cdFailureMessage(error), "API_TIMEOUT provider=vercel operation=deployment.read");
      return true;
    });
  t.mock.method(globalThis, "fetch", async () => new Response("synthetic-secret-invalid-json"));
  await assert.rejects(api("github", "https://sensitive.example", "secret")("ci.read", "/private-id"),
    (error: unknown) => {
      assert.equal(cdFailureMessage(error), "API_RESPONSE provider=github operation=ci.read");
      return true;
    });
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
