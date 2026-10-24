import assert from "node:assert/strict";
import { test } from "node:test";
import { api, cdFailureMessage } from "../scripts/cd/http";
import { verifyVercelProject } from "../scripts/cd/vercel";

const project = { id: "prj_synthetic", buildCommand: "npm run release:check && npm run build",
  link: { type: "github", productionBranch: "main", org: "synthetic", repo: "archive", repoId: "123" } };

test("Vercel preflight succeeds using only project/deployment resources without team or billing access", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path.startsWith("/v2/teams")) return Response.json({ error: "forbidden" }, { status: 403 });
    if (path === "/v9/projects/prj_synthetic") return Response.json(project);
    if (path === "/v6/deployments") return Response.json({ deployments: [] });
    assert.fail("unexpected API request");
  });
  assert.deepEqual(await verifyVercelProject(api("vercel", "https://api.example", "synthetic"), project.id, "synthetic/archive"), project);
  assert.deepEqual(calls, ["/v9/projects/prj_synthetic", "/v6/deployments"]);
});

test("required Vercel permissions still fail closed with an identifiable operation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("private-provider-details", { status: 403 }));
  await assert.rejects(verifyVercelProject(api("vercel", "https://api.example", "secret"), project.id, "synthetic/archive"),
    (error: unknown) => {
      assert.equal(cdFailureMessage(error), "API_HTTP_403 provider=vercel operation=project.read");
      return true;
    });
});

test("Vercel project binding, build command and active production deployment guards remain enforced", async (t) => {
  for (const [change, deployments, code] of [
    [{ id: "prj_other" }, [], "VERCEL_PROJECT_BINDING"],
    [{ buildCommand: "npm run build" }, [], "VERCEL_BUILD_COMMAND"],
    [{}, [{ state: "BUILDING" }], "REMOTE_DEPLOYMENT_ACTIVE"],
  ] as const) {
    const fetch = t.mock.method(globalThis, "fetch", async (url: string) => Response.json(
      new URL(url).pathname === "/v6/deployments" ? { deployments } : { ...project, ...change }));
    await assert.rejects(verifyVercelProject(api("vercel", "https://api.example", "synthetic"), project.id, "synthetic/archive"),
      new RegExp(code));
    fetch.mock.restore();
  }
});
