import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import "../scripts/env";
import { localDatabaseUrl } from "../src/db/environment";
import { createDatabase } from "../src/db/connection";
import { readHomeSummary, findTrip, listTrips } from "../src/db/queries";
import { fixtureIds } from "../src/db/fixtures";
import { eq } from "drizzle-orm";
import { matches, clubs, stadiums } from "../src/db/schema";
import { storageFixture } from "./storage-fixture";
import { authFixture } from "./auth-fixture";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

let server: ReturnType<typeof spawn>;
let origin: string;
let output = "";
let identity: Awaited<ReturnType<typeof authFixture>>;
let storage: Awaited<ReturnType<typeof storageFixture>>;

before(async () => {
  identity = await authFixture();
  storage = await storageFixture();
  // Ask the OS for a free port so the suite does not depend on port 3000.
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;
  await new Promise((resolve) => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port),
  ], { env: { ...process.env, DATABASE_URL: localDatabaseUrl("testing"), ARCHIVE_TEST_SERVER: "1", STORAGE_ENVIRONMENT: "testing", TEST_AWS_ENDPOINT_URL_S3: storage.endpoint, TEST_AWS_REGION: "us-east-1", TEST_STORAGE_BUCKET: "elche-away-test", TEST_AWS_ACCESS_KEY_ID: "synthetic-storage-id", TEST_AWS_SECRET_ACCESS_KEY: "synthetic-storage-secret", TEST_STORAGE_DATABASE_HOST: new URL(localDatabaseUrl("testing")).hostname.replace("-pooler", ""), NEON_AUTH_BASE_URL: identity.baseUrl, NEON_AUTH_COOKIE_SECRET: "synthetic-cookie-secret-only-for-local-tests-123456", ADMIN_USER_ID: identity.ownerId, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", (chunk) => { output = (output + chunk).slice(-12000); });
  server.stderr!.on("data", (chunk) => { output = (output + chunk).slice(-12000); });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js stopped: ${output}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(10000) });
      if (response.ok) return;
    } catch { /* Retry while the development server compiles. */ }
    await delay(300);
  }
  throw new Error(`Next.js was not ready: ${output}`);
}, { timeout: 100000 });

after(async () => {
  if (!server || server.exitCode !== null) { await identity?.close(); await storage?.close(); return; }
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const forceKill = setTimeout(() => server.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(forceKill); await identity?.close(); await storage?.close(); }
});

const pages = [
  { path: "/", label: "Mapa", title: /Donde tú vayas\./ },
  { path: "/trips", label: "Viajes", title: /<h1>Viajes<\/h1>/ },
  { path: "/stadiums", label: "Estadios", title: /<h1>Estadios<\/h1>/ },
  { path: "/map", label: "Mapa", title: /Donde tú vayas\./ },
];

for (const { path, label, title } of pages) {
  test(`${path} serves Spanish content and usable primary navigation`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html lang="es">/);
    assert.match(html, title);
    assert.match(html, /<main[^>]+id="main-content"/);
    assert.match(html, /href="#main-content"/);
    assert.match(html, /Sin vinculación oficial con el Elche CF/);
    const navigation = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0];
    assert.ok(navigation, "Primary navigation is server-rendered");
    for (const href of ["/", "/?view=trips", "/?view=stadiums", "/?view=summary"]) assert.ok(navigation.includes(`href="${href}"`));
    assert.match(navigation, new RegExp(`aria-current="page"[^>]*>${label}</a>`));
    assert.equal((navigation.match(/aria-current="page"/g) ?? []).length, 1);
  });
}

test("missing pages return HTTP 404 with a Spanish recovery link", async () => {
  const response = await fetch(`${origin}/not-a-real-page`);
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /No encontramos esta página/);
  assert.match(html, /Volver al inicio/);
});


test("public details and stadium visits come from attendance only", async () => {
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  try {
    const trips = await listTrips(db);
    for (const trip of trips) {
      const response = await fetch(`${origin}/trips/${trip.slug}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Recuerdos del viaje/);
      assert.doesNotMatch(html, /UNATTENDED_FIXTURE_NOT_PUBLIC/);
    }
    const cup = trips.find((trip) => trip.competition === "Copa de ejemplo");
    assert.ok(cup);
    const cupHtml = await (await fetch(`${origin}/trips/${cup.slug}`)).text();
    assert.match(cupHtml, /División de ejemplo/);
    assert.match(cupHtml, /Un partido especial/);
    const ground = await fetch(`${origin}/stadiums/estadio-del-corcho-ejemplo`);
    assert.equal(ground.status, 200);
    assert.match(await ground.text(), /2<!-- --> <!-- -->visitas en el archivo|2 visitas en el archivo/);
    const notVisited = await fetch(`${origin}/stadiums/estadio-no-visitado-ejemplo`);
    assert.equal(notVisited.status, 404);
    assert.equal((await fetch(`${origin}/trips/nonexistent-trip`)).status, 404);
    assert.equal((await fetch(`${origin}/trips/${fixtureIds.unattendedMatch}`)).status, 404);
    const index = await (await fetch(`${origin}/trips`)).text();
    assert.doesNotMatch(index, /UNATTENDED_FIXTURE_NOT_PUBLIC|Estadio no visitado/);
    assert.match(index, /Fecha desconocida/);
  } finally { await pool.end(); }
});

test("a fixture correction appears on the next request without changing its URL", async () => {
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const trip = await findTrip(db, (await listTrips(db)).find((row) => row.competition === "Copa de ejemplo")!.slug);
  assert.ok(trip);
  try {
    await db.update(matches).set({ phase: "Corrección sintética visible inmediatamente" }).where(eq(matches.id, fixtureIds.homeMatch));
    const html = await (await fetch(`${origin}/trips/${trip.slug}`)).text();
    assert.match(html, /Corrección sintética visible inmediatamente/);
  } finally {
    await db.update(matches).set({ phase: trip.phase }).where(eq(matches.id, fixtureIds.homeMatch));
    await pool.end();
  }
});


test("Google login and account bootstrap do not expose admin data to unauthenticated users", async () => {
  const login = await fetch(`${origin}/auth/sign-in`);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Continuar con Google/);
  const response = await fetch(`${origin}/admin`, { redirect: "manual" });
  assert.ok([302, 307].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /auth\/sign-in/);
  const account = await (await fetch(`${origin}/auth/account`)).text();
  assert.match(account, /Continuar con Google/);
});

test("OAuth return exchanges the verifier before rendering the account and grants no admin permission", async () => {
  const callback = await fetch(`${origin}/auth/account?neon_auth_session_verifier=synthetic-verifier`, {
    redirect: "manual", headers: { Cookie: "__Secure-neon-auth.session_challenge=synthetic-challenge" },
  });
  assert.ok([302, 307].includes(callback.status));
  assert.equal(new URL(callback.headers.get("location")!, origin).pathname, "/auth/account");
  assert.doesNotMatch(callback.headers.get("location")!, /neon_auth_session_verifier/);
  const cookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Secure-neon-auth.session_token="))?.split(";")[0];
  assert.ok(cookie, "Native middleware must store the exchanged session token");
  const account = await (await fetch(`${origin}/auth/account`, { headers: { Cookie: cookie } })).text();
  assert.match(account, /synthetic-other-user/);
  const admin = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
  assert.match(admin, /Acceso restringido/);
  assert.doesNotMatch(admin, /Crear referencia/);
  const invalid = await fetch(`${origin}/auth/account?neon_auth_session_verifier=invalid`, {
    redirect: "manual", headers: { Cookie: "__Secure-neon-auth.session_challenge=synthetic-challenge" },
  });
  assert.match(invalid.headers.get("location") ?? "", /auth\/sign-in/);
  assert.ok(!invalid.headers.getSetCookie().some((value) => value.startsWith("__Secure-neon-auth.session_token=")));
});

test("verified wrong accounts and forged cookies cannot read administration", async () => {
  const wrong = await fetch(`${origin}/admin`, { headers: { Cookie: identity.otherCookie } });
  const html = await wrong.text();
  assert.match(html, /Acceso restringido/);
  assert.doesNotMatch(html, /Crear referencia|club-norte-ejemplo/);
  const forged = await fetch(`${origin}/admin`, { headers: { Cookie: "__Secure-neon-auth.session_token=forged; __Secure-neon-auth.local.session_data=forged" }, redirect: "manual" });
  assert.ok([302, 307].includes(forged.status));
  const ownAccount = await (await fetch(`${origin}/auth/account`, { headers: { Cookie: identity.otherCookie } })).text();
  assert.match(ownAccount, /synthetic-other-user/);
  assert.doesNotMatch(ownAccount, /Tu identidad está autorizada/);
});

test("configured owner can read all reference categories through the native session SDK", async () => {
  for (const section of ["clubs", "stadiums", "competitions", "tiers", "seasons"]) {
    const response = await fetch(`${origin}/admin?section=${section}`, { headers: { Cookie: identity.ownerCookie } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Crear referencia/);
  }
});

async function actionId(name = "mutateReference") {
  // Exercise the actual server-action entry point, independently of page gating.
  const manifest = JSON.parse(await readFile(".next-test/dev/server/server-reference-manifest.json", "utf8"));
  const entries = Object.entries(manifest.node) as [string, { exportedName?: string; workers: Record<string, { moduleId: string | number; async: boolean }> }][];
  const found = entries.find(([, action]) => action.exportedName === name);
  if (!found) throw new Error(`${name} missing from test server action manifest`);
  return found[0];
}

test("direct admin action requests deny unauthenticated/wrong users without changing PostgreSQL", async () => {
  const id = await actionId();
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  try {
    const before = await db.select().from(clubs).orderBy(clubs.id);
    for (const cookie of ["", identity.otherCookie]) {
      const response = await fetch(`${origin}/admin`, { method: "POST", redirect: "manual", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Origin: origin, Cookie: cookie }, body: '[null,{}]' });
      const html = await response.text();
      assert.ok([200, 302, 303, 307].includes(response.status));
      assert.ok(/No tienes permiso|Acceso restringido|auth\/sign-in/.test(html + response.headers.get("location")));
    }
    assert.deepEqual(await db.select().from(clubs).orderBy(clubs.id), before);
  } finally { await pool.end(); }
});

test("owner identity must remain backed by a live upstream session; outages fail closed", async () => {
  const initial = await fetch(`${origin}/admin`, { headers: { Cookie: identity.ownerCookie } });
  const cache = initial.headers.getSetCookie().find((value) => value.startsWith("__Secure-neon-auth.local.session_data="))?.split(";")[0];
  identity.revokeOwner();
  try {
    const response = await fetch(`${origin}/admin`, { headers: { Cookie: [identity.ownerCookie, cache].filter(Boolean).join("; ") }, redirect: "manual" });
    const html = await response.text();
    assert.doesNotMatch(html, /Crear referencia/);
  } finally { identity.restoreOwner(); }
  identity.outage(true);
  try {
    const response = await fetch(`${origin}/admin`, { headers: { Cookie: identity.ownerCookie }, redirect: "manual" });
    assert.doesNotMatch(await response.text(), /Crear referencia/);
  } finally { identity.outage(false); }
});


test("configured owner can create/edit/delete through actual Server Actions; forged identity fields grant nothing", async () => {
  const require = createRequire(import.meta.url);
  const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.node") as { encodeReply: (value: unknown[]) => Promise<string | FormData> };
  const id = await actionId();
  async function submit(values: Record<string, string>, cookie: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    const body = await encodeReply([{ ok: false, message: "" }, form]);
    const response = await fetch(`${origin}/admin`, { method: "POST", headers: { "Next-Action": id, Origin: origin, Cookie: cookie }, body });
    return response.text();
  }
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const name = `Club HTTP sintético ${randomUUID()}`;
  let createdId: string | undefined;
  try {
    await submit({ kind: "clubs", intent: "save", name, userId: identity.ownerId, role: "admin" }, identity.otherCookie);
    assert.equal((await db.select().from(clubs).where(eq(clubs.name, name))).length, 0);
    const result = await submit({ kind: "clubs", intent: "save", name }, identity.ownerCookie);
    assert.match(result, /Referencia guardada/);
    const [created] = await db.select().from(clubs).where(eq(clubs.name, name));
    assert.ok(created);createdId = created.id;
    await submit({ kind: "clubs", intent: "save", id: created.id, name: "Club HTTP corregido" }, identity.ownerCookie);
    const [updated] = await db.select().from(clubs).where(eq(clubs.id, created.id));
    assert.equal(updated.name, "Club HTTP corregido");
    assert.equal(updated.slug, created.slug);
    const protectedDelete = await submit({ kind: "stadiums", intent: "delete", id: fixtureIds.ground, confirmDelete: "yes" }, identity.ownerCookie);
    assert.match(protectedDelete, /referencia est[áa] en uso/);
    await submit({ kind: "clubs", intent: "delete", id: created.id, confirmDelete: "yes" }, identity.ownerCookie);
    assert.equal((await db.select().from(clubs).where(eq(clubs.id, created.id))).length, 0);
  } finally {
    if (createdId) await db.delete(clubs).where(eq(clubs.id, createdId));
    await pool.end();
  }
});


test("native sign-out clears access and a reused session token cannot administer", async () => {
  try {
    const response = await fetch(`${origin}/api/auth/sign-out`, { method: "POST", headers: { Cookie: identity.ownerCookie, Origin: origin, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 200);
    const admin = await fetch(`${origin}/admin`, { headers: { Cookie: identity.ownerCookie }, redirect: "manual" });
    assert.ok([302, 307].includes(admin.status));
    const account = await (await fetch(`${origin}/auth/account`, { headers: { Cookie: identity.ownerCookie } })).text();
    assert.match(account, /Continuar con Google/);
  } finally { identity.restoreOwner(); }
});


test("fixture browser and actual fixture actions enforce owner authorization and publish attendance", async () => {
  const ownerPage = await (await fetch(`${origin}/admin`, { headers: { Cookie: identity.ownerCookie } })).text();
  assert.match(ownerPage, /Partidos locales/);
  assert.match(ownerPage, /UNATTENDED_FIXTURE_NOT_PUBLIC/);
  const id = await actionId("mutateFixture");
  const require = createRequire(import.meta.url);
  const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.node") as { encodeReply: (value: unknown[]) => Promise<string | FormData> };
  async function submit(values: Record<string, string>, cookie: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    const body = await encodeReply([{ ok: false, message: "" }, form]);
    const response = await fetch(`${origin}/admin`, { method: "POST", redirect: "manual", headers: { "Next-Action": id, Origin: origin, Cookie: cookie }, body });
    return response.text();
  }
  const { attendance } = await import("../src/db/schema");
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const marker = `HTTP synthetic fixture ${randomUUID()}`;
  let createdId: string | undefined;
  try {
    const beforeFixtures = await db.select().from(matches).orderBy(matches.id);
    const beforeAttendance = await db.select().from(attendance).orderBy(attendance.matchId);
    for (const cookie of ["", identity.otherCookie]) {
      for (const intent of ["save", "attend", "unattend", "delete"]) {
        await submit({ intent, id: fixtureIds.homeMatch, factualNotes: marker, status: "unknown", confirmDelete: "yes", userId: identity.ownerId }, cookie);
      }
    }
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), beforeFixtures);
    assert.deepEqual(await db.select().from(attendance).orderBy(attendance.matchId), beforeAttendance);
    assert.equal((await db.select().from(matches).where(eq(matches.factualNotes, marker))).length, 0);
    assert.equal((await db.select().from(attendance).where(eq(attendance.matchId, fixtureIds.unattendedMatch))).length, 0);
    assert.ok((await db.select().from(matches).where(eq(matches.id, fixtureIds.unattendedMatch))).length);
    assert.match(await submit({ intent: "save", status: "unknown", factualNotes: marker, confirmDuplicate: "yes" }, identity.ownerCookie), /Partido guardado/);
    const [created] = await db.select().from(matches).where(eq(matches.factualNotes, marker));
    assert.ok(created); createdId = created.id;
    await submit({ intent: "attend", id: created.id, notes: "Memoria pública sintética", isSpecial: "yes" }, identity.ownerCookie);
    const [personal] = await db.select().from(attendance).where(eq(attendance.matchId, created.id));
    assert.ok(personal);
    assert.match(await (await fetch(`${origin}/trips/${personal.slug}`)).text(), /Memoria pública sintética/);
    assert.match(await submit({ intent: "delete", id: created.id, confirmDelete: "yes" }, identity.ownerCookie), /Desmarca primero/);
    await submit({ intent: "unattend", id: created.id, confirmDelete: "yes" }, identity.ownerCookie);
    assert.equal((await fetch(`${origin}/trips/${personal.slug}`)).status, 404);
    await submit({ intent: "delete", id: created.id, confirmDelete: "yes" }, identity.ownerCookie);
    assert.equal((await db.select().from(matches).where(eq(matches.id, created.id))).length, 0);
  } finally {
    if (createdId) {
      await db.delete(attendance).where(eq(attendance.matchId, createdId));
      await db.delete(matches).where(eq(matches.id, createdId));
    }
    await pool.end();
  }
});

test("import page and all upload/preview/apply actions authorize independently; owner reviews before writing", async () => {
  const { matchSources } = await import("../src/db/schema");
  const { digest } = await import("../src/server/import-input");
  const { ELCHE_CLUB_ID } = await import("../src/lib/identity");
  const { encodeReply, createFromReadableStream } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-turbopack/client.node") as {
    encodeReply: (value: unknown[]) => Promise<string | FormData>;
    createFromReadableStream: (stream: ReadableStream<Uint8Array>, options: { serverConsumerManifest: { moduleMap: object; serverModuleMap: object; moduleLoading: null } }) => Promise<{ a?: Promise<{ message: string; token?: string; input?: unknown }> }>;
  };
  const page = await fetch(`${origin}/admin/import`, { headers: { Cookie: identity.ownerCookie } });
  assert.match(await page.text(), /Importar partidos/);
  assert.match(await (await fetch(`${origin}/admin/import`, { headers: { Cookie: identity.otherCookie } })).text(), /Acceso restringido/);
  const action = await actionId("importFixtures");
  async function submit(form: FormData, cookie: string) {
    const response = await fetch(`${origin}/admin/import`, { method: "POST", redirect: "manual", headers: { "Next-Action": action, Origin: origin, Cookie: cookie }, body: await encodeReply([form]) });
    const text = await response.text();
    // React may encode a long signed token as a separate text chunk. Decode
    // the real Flight protocol instead of treating each line as plain JSON.
    let state;
    if (text.includes('"token"')) {
      const stream = new Response(text).body!;
      const root = await createFromReadableStream(stream, { serverConsumerManifest: { moduleMap: {}, serverModuleMap: {}, moduleLoading: null } });
      state = await root.a;
    }
    return { text, state };
  }
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const path = `2037-38/http-${randomUUID()}.json`;
  try {
    const beforeMatches = await db.select().from(matches).orderBy(matches.id);
    const beforeSources = await db.select().from(matchSources).orderBy(matchSources.id);
    for (const cookie of ["", identity.otherCookie]) {
      for (const intent of ["inspect", "preview", "apply"]) {
        const form = new FormData(); form.set("intent", intent); form.set("userId", identity.ownerId);
        const result = await submit(form, cookie);
        assert.match(result.text, /No tienes permiso|auth\/sign-in/);
      }
    }
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), beforeMatches);
    assert.deepEqual(await db.select().from(matchSources).orderBy(matchSources.id), beforeSources);
    const record = { date: "2037-10-15", team1: "Elche CF", team2: "Rival HTTP sintético", score: { ft: [2, 1] } };
    const input = { repository: "openfootball/football.json", path, revision: "d".repeat(40), content: JSON.stringify([record]), format: "json", seasonId: fixtureIds.season, competitionId: fixtureIds.league, elcheName: "Elche CF", offset: 0, resultsConfirmed: true, mappings: {}, targets: {} };
    const upload = new FormData();
    for (const [key, value] of Object.entries(input)) if (!["content", "mappings", "targets", "resultsConfirmed"].includes(key)) upload.set(key, String(value));
    upload.set("resultsConfirmed", "yes"); upload.set("intent", "inspect"); upload.set("file", new File([input.content], "synthetic.json", { type: "application/json" }));
    const inspected = await submit(upload, identity.ownerCookie);
    assert.match(inspected.text, /Archivo leído sin guardar/);
    const form = new FormData(); form.set("intent", "preview"); form.set("input", JSON.stringify(input));
    form.set("club-0", ELCHE_CLUB_ID); form.set("club-1", fixtureIds.north); form.set("target-0", "new");
    const reviewed = await submit(form, identity.ownerCookie);
    assert.ok(reviewed.state?.token, reviewed.text.slice(-1500));
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), beforeMatches);
    const apply = new FormData(); apply.set("intent", "apply"); apply.set("confirmApply", "yes"); apply.set("token", reviewed.state.token + "tamper");
    assert.match((await submit(apply, identity.ownerCookie)).text, /modificado/);
    apply.set("token", reviewed.state.token);
    assert.match((await submit(apply, identity.otherCookie)).text, /No tienes permiso/);
    assert.match((await submit(apply, identity.ownerCookie)).text, /Lote aplicado: 1 nuevos/);
    const sources = await db.select().from(matchSources).where(eq(matchSources.path, path));
    assert.equal(sources.length, 1);
    assert.equal(sources[0].fingerprint, digest({ home: record.team1, away: record.team2, playedOn: record.date, homeScore: 2, awayScore: 1, phase: null }));
    const publicTrips = await listTrips(db);
    assert.ok(publicTrips.every((trip) => trip.playedOn !== record.date));
  } finally {
    const sources = await db.select().from(matchSources).where(eq(matchSources.path, path));
    await db.delete(matchSources).where(eq(matchSources.path, path));
    for (const source of sources) await db.delete(matches).where(eq(matches.id, source.matchId));
    await pool.end();
  }
});

test("direct-import actions require owner access before acquisition, and signed global approval controls batch writes", async () => {
  const { newGlobalPlan, previewGlobalImport } = await import("../src/db/global-import");
  const { signGlobalPlan } = await import("../src/server/global-review");
  const { importBatches, matchSources } = await import("../src/db/schema");
  const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-turbopack/client.node") as { encodeReply: (value: unknown[]) => Promise<string | FormData> };
  await fetch(`${origin}/admin/import`, { headers: { Cookie: identity.ownerCookie } });
  const action = await actionId("directImport");
  async function submit(values: Record<string, string>, cookie: string) {
    const form = new FormData(); for (const [name, value] of Object.entries(values)) form.set(name, value);
    const response = await fetch(`${origin}/admin/import`, { method: "POST", redirect: "manual", headers: { "Next-Action": action, Origin: origin, Cookie: cookie }, body: await encodeReply([form]) });
    return { text: await response.text() };
  }
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const path = `2018-19/global-http-${randomUUID()}.json`;
  let planId: string | undefined;
  const createdRefs: { kind: "clubs" | "seasons" | "competitions"; id: string }[] = [];
  try {
    const before = await db.select().from(matches).orderBy(matches.id);
    const receiptCount = (await db.select().from(importBatches)).length;
    for (const cookie of ["", identity.otherCookie]) for (const intent of ["check", "preview", "resume", "apply"]) {
      assert.match((await submit({ intent, startYear: "2017", endYear: "2018", userId: identity.ownerId }, cookie)).text, /No tienes permiso|auth\/sign-in/);
    }
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), before);
    assert.equal((await db.select().from(importBatches)).length, receiptCount);
    const acquired = { startYear: 2018, endYear: 2018, coverage: [], revisions: { "openfootball/football.json": "a".repeat(40) }, files: [{ repository: "openfootball/football.json" as const, revision: "a".repeat(40), path, year: 2018, competition: "Competición HTTP global sintética", records: [{ home: "Elche CF", away: "Rival global HTTP sintético", playedOn: "2018-09-12", homeScore: 2, awayScore: 1, phase: null }] }] };
    const plan = await newGlobalPlan(db, acquired, true); planId = plan.id;
    let preview = await previewGlobalImport(db, plan);
    for (const b of preview.batches) for (const r of b.rows) plan.targets[r.sourceId] = "new";
    preview = await previewGlobalImport(db, plan);
    assert.equal(preview.applicable, true);
    for (const ref of plan.references.filter((r) => r.choice === "new")) createdRefs.push({ kind: ref.kind, id: ref.id });
    const token = signGlobalPlan(plan, "synthetic-cookie-secret-only-for-local-tests-123456");
    const reviewValues: Record<string, string> = { intent: "preview", token };
    plan.references.forEach((ref, i) => { reviewValues[`ref-${i}`] = ref.choice; });
    for (const [sourceId, target] of Object.entries(plan.targets)) reviewValues[`target-${sourceId}`] = target;
    assert.match((await submit(reviewValues, identity.ownerCookie)).text, /"resultsConfirmed":false/);
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), before);
    assert.match((await submit({ intent: "apply", token }, identity.ownerCookie)).text, /Confirma el preview global/);
    assert.deepEqual(await db.select().from(matches).orderBy(matches.id), before);
    assert.match((await submit({ intent: "apply", token: token + "tamper", confirmGlobal: "yes" }, identity.ownerCookie)).text, /modificado/);
    const applied = await submit({ intent: "apply", token, confirmGlobal: "yes" }, identity.ownerCookie);
    assert.match(applied.text, /Lote 1 aplicado/);
    assert.match((await submit({ intent: "apply", token, confirmGlobal: "yes" }, identity.ownerCookie)).text, /ya aplicado/);
    assert.equal((await db.select().from(matchSources).where(eq(matchSources.path, path))).length, 1);
    assert.equal((await db.select().from(importBatches).where(eq(importBatches.planId, plan.id))).length, 1);
    assert.match((await submit({ intent: "resume", token }, identity.ownerCookie)).text, /Estado recuperado/);
  } finally {
    const links = await db.select().from(matchSources).where(eq(matchSources.path, path));
    await db.delete(matchSources).where(eq(matchSources.path, path));
    for (const link of links) await db.delete(matches).where(eq(matches.id, link.matchId));
    if (planId) await db.delete(importBatches).where(eq(importBatches.planId, planId));
    const { seasons, competitions } = await import("../src/db/schema");
    for (const ref of createdRefs) { const table = { clubs, seasons, competitions }[ref.kind]; await db.delete(table).where(eq(table.id, ref.id)); }
    await pool.end();
  }
});

test("home renders attendance totals and explicit result and venue coverage", async () => {
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  try {
    const summary = await readHomeSummary(db);
    const html = (await (await fetch(`${origin}/?view=summary`)).text()).replace(/<!-- -->/g, "");
    assert.match(html, /El archivo en cifras/);
    for (const [label, value] of [["Viajes", summary.trips], ["Estadios conocidos", summary.stadiums], ["Victorias", summary.wins], ["Empates", summary.draws], ["Derrotas", summary.losses]]) {
      assert.ok(html.includes(`<dt>${label}</dt><dd>${value}</dd>`));
    }
    assert.ok(html.includes(`Resultados conocidos de partidos finalizados: ${summary.knownResults} de ${summary.trips} viajes`));
    assert.ok(html.includes(`Estadio conocido: ${summary.knownVenues} de ${summary.trips} viajes`));
    assert.doesNotMatch(html, /UNATTENDED_FIXTURE_NOT_PUBLIC/);
  } finally { await pool.end(); }
});


test("map and panels explain an empty attendance archive without publishing unattended fixtures", async () => {
  const { attendance } = await import("../src/db/schema");
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  // This connection belongs exclusively to the uniquely generated test database.
  const before = await db.select().from(attendance);
  try {
    await db.delete(attendance);
    for (const path of ["/", "/?view=stadiums", "/?view=trips", "/?view=summary"]) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200);
      const html = (await response.text()).replace(/<!-- -->/g, "");
      assert.match(html, /Estadios con coordenadas: 0 de 0/);
      assert.match(html, /Todavía no hay estadios visitados publicados/);
      assert.doesNotMatch(html, /UNATTENDED_FIXTURE_NOT_PUBLIC|href="\/\?stadium=/);
      if (path.endsWith("trips")) assert.match(html, /Todavía no hay viajes publicados/);
      if (path.endsWith("summary")) assert.match(html, /Resultados conocidos de partidos finalizados: 0 de 0 viajes/);
    }
  } finally {
    try { if (before.length) await db.insert(attendance).values(before); }
    finally { await pool.end(); }
  }
});

test("map panels preserve attendance-only links and coordinate coverage without JavaScript", async () => {
  const response = await fetch(`${origin}/?view=stadiums`);
  const html = (await response.text()).replace(/<!-- -->/g, "");
  assert.match(html, /Estadios con coordenadas: 0 de 2/);
  assert.match(html, /Sin coordenadas: 2/);
  assert.match(html, /href="\/\?stadium=estadio-del-corcho-ejemplo"/);
  assert.match(html, /href="\/\?stadium=campo-del-recuerdo-ejemplo"/);
  assert.doesNotMatch(html, /estadio-no-visitado-ejemplo/);
  assert.match(html, /Todavía no hay coordenadas/);
  assert.match(html, /class="stadium-map"/);
  assert.match(html, /Ampliar panel/);
  assert.match(html, /Ver página completa de estadios/);
  assert.match(html, /El mapa interactivo necesita JavaScript/);
});

test("shared map details survive direct requests and retain complete-page alternatives", async () => {
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  try {
    const trips = await listTrips(db);
    for (const trip of trips) {
      const response = await fetch(`${origin}/?trip=${trip.slug}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Recuerdos del viaje/);
      assert.ok(html.includes(`href="/trips/${trip.slug}"`));
      assert.match(html, /Cerrar panel y volver al mapa/);
      assert.doesNotMatch(html, /UNATTENDED_FIXTURE_NOT_PUBLIC/);
    }
    const stadium = await (await fetch(`${origin}/?stadium=estadio-del-corcho-ejemplo`)).text();
    assert.match(stadium, /Sin coordenadas: puedes consultar sus visitas/);
    assert.match(stadium, /href="\/stadiums\/estadio-del-corcho-ejemplo"/);
    for (const trip of trips.filter((trip) => trip.stadiumId === fixtureIds.ground)) assert.ok(stadium.includes(`href="/?trip=${trip.slug}"`));
    for (const query of ["stadium=estadio-no-visitado-ejemplo", `trip=${fixtureIds.unattendedMatch}`, "trip=missing", "view=unknown", "trip=a&stadium=b", "view=trips&view=summary"]) {
      const response = await fetch(`${origin}/?${query}`);
      assert.equal(response.status, 404, query);
      assert.doesNotMatch(await response.text(), /UNATTENDED_FIXTURE_NOT_PUBLIC/);
    }
    const alias = await fetch(`${origin}/map?stadium=estadio-del-corcho-ejemplo`, { redirect: "manual" });
    assert.equal(alias.status, 307);
    assert.equal(new URL(alias.headers.get("location")!, origin).searchParams.get("stadium"), "estadio-del-corcho-ejemplo");
  } finally { await pool.end(); }
});

test("map panels retain unlocated stadiums after another venue gains coordinates", async () => {
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const [before] = await db.select().from(stadiums).where(eq(stadiums.id, fixtureIds.ground));
  try {
    await db.update(stadiums).set({ latitude: 38.2, longitude: -0.7 }).where(eq(stadiums.id, fixtureIds.ground));
    const html = (await (await fetch(`${origin}/?view=stadiums`)).text()).replace(/<!-- -->/g, "");
    assert.match(html, /Estadios con coordenadas: 1 de 2/);
    assert.match(html, /Sin coordenadas: 1/);
    assert.match(html, /Ciudad de ejemplo/);
    assert.match(html, /campo-del-recuerdo-ejemplo/);
    assert.doesNotMatch(html, /estadio-no-visitado-ejemplo/);
  } finally {
    await db.update(stadiums).set({ latitude: before.latitude, longitude: before.longitude }).where(eq(stadiums.id, before.id));
    await pool.end();
  }
});



test("crest HTTP operations authorize every request, normalize images and recover cleanup", async () => {
  const sharp = (await import("sharp")).default;
  const { storageCleanup } = await import("../src/db/schema");
  const { db, pool } = createDatabase(localDatabaseUrl("testing"));
  const id = randomUUID();
  const png = await sharp({ create: { width: 64, height: 32, channels: 4, background: "#155d43" } }).png().withExif({ IFD0: { Artist: "Synthetic EXIF" } }).toBuffer();
  async function submit(intent: string, cookie: string, expected = "", bytes: Buffer = png, type = "image/png", originHeader = origin) {
    const form = new FormData(); form.set("intent", intent); form.set("clubId", id); form.set("expectedKey", expected); form.set("confirmRemove", "yes");
    if (intent === "upload") form.set("file", new File([new Uint8Array(bytes)], "synthetic.png", { type }));
    return fetch(`${origin}/api/admin/club-crest`, { method: "POST", headers: { Origin: originHeader, Cookie: cookie }, body: form });
  }
  await db.insert(clubs).values({ id, name: "Club de escudo HTTP sintético", slug: `crest-http-${id}` });
  try {
    const before = storage.writes();
    for (const cookie of ["", identity.otherCookie]) for (const intent of ["upload", "remove", "cleanup"]) assert.equal((await submit(intent, cookie)).status, 403);
    assert.equal((await submit("upload", identity.ownerCookie, "", png, "image/png", "https://other.invalid")).status, 403);
    assert.equal(storage.writes(), before);
    const invalid = await submit("upload", identity.ownerCookie, "", Buffer.from("<svg/>"), "image/svg+xml");
    assert.equal(invalid.status, 400, await invalid.text());
    assert.equal((await submit("upload", identity.ownerCookie, "", Buffer.alloc(1_000_001))).status, 400);
    assert.equal(storage.writes(), before);
    assert.equal((await submit("upload", identity.ownerCookie)).status, 200);
    const [first] = await db.select().from(clubs).where(eq(clubs.id, id));
    assert.ok(first.crestObjectKey);
    const publicUrl = `${origin}/media/${first.crestObjectKey}`;
    const image = await fetch(publicUrl);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("cache-control") || "", /immutable/);
    const info = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    assert.equal(info.format, "webp"); assert.equal(info.exif, undefined);
    const admin = await (await fetch(`${origin}/admin?section=clubs`, { headers: { Cookie: identity.ownerCookie } })).text();
    assert.match(admin, /Subir escudo|Reemplazar escudo/);
    assert.doesNotMatch(admin, /synthetic-storage-secret/);
    assert.equal((await submit("upload", identity.ownerCookie)).status, 409);
    assert.equal((await submit("upload", identity.ownerCookie, first.crestObjectKey)).status, 200);
    const [second] = await db.select().from(clubs).where(eq(clubs.id, id));
    assert.notEqual(second.crestObjectKey, first.crestObjectKey);
    assert.equal(storage.objects.has(first.crestObjectKey), false);
    assert.equal((await fetch(publicUrl)).status, 404);
    assert.equal((await submit("remove", identity.ownerCookie, first.crestObjectKey)).status, 409);
    assert.equal((await submit("remove", identity.ownerCookie, second.crestObjectKey!)).status, 200);
    assert.equal(storage.objects.has(second.crestObjectKey!), false);
    assert.equal((await db.select().from(clubs).where(eq(clubs.id, id)))[0].crestObjectKey, null);
  } finally {
    for (const key of storage.objects.keys()) if (key.startsWith(`crests/${id}/`)) storage.objects.delete(key);
    await db.delete(storageCleanup).where(eq(storageCleanup.objectKey, (await db.select().from(clubs).where(eq(clubs.id, id)))[0]?.crestObjectKey || ""));
    await db.delete(clubs).where(eq(clubs.id, id)); await pool.end();
  }
});
