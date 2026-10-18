import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import "../scripts/env";
import { localDatabaseUrl } from "../src/db/environment";
import { createDatabase } from "../src/db/connection";
import { findTrip, listTrips } from "../src/db/queries";
import { fixtureIds } from "../src/db/fixtures";
import { eq } from "drizzle-orm";
import { matches, clubs } from "../src/db/schema";
import { authFixture } from "./auth-fixture";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

let server: ReturnType<typeof spawn>;
let origin: string;
let output = "";
let identity: Awaited<ReturnType<typeof authFixture>>;

before(async () => {
  identity = await authFixture();
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
  ], { env: { ...process.env, DATABASE_URL: localDatabaseUrl("testing"), ARCHIVE_TEST_SERVER: "1", NEON_AUTH_BASE_URL: identity.baseUrl, NEON_AUTH_COOKIE_SECRET: "synthetic-cookie-secret-only-for-local-tests-123456", ADMIN_USER_ID: identity.ownerId, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
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
  if (!server || server.exitCode !== null) { await identity?.close(); return; }
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const forceKill = setTimeout(() => server.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(forceKill); await identity?.close(); }
});

const pages = [
  { path: "/", label: "Inicio", title: /Donde tú(?:<!-- -->)?<br\s*\/>/ },
  { path: "/trips", label: "Viajes", title: /<h1>Viajes<\/h1>/ },
  { path: "/stadiums", label: "Estadios", title: /<h1>Estadios<\/h1>/ },
  { path: "/map", label: "Mapa", title: /<h1>Mapa<\/h1>/ },
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
    for (const page of pages) assert.ok(navigation.includes(`href="${page.path}"`));
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
  assert.match(account, /No has iniciado sesión/);
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

async function actionId() {
  // Exercise the actual server-action entry point, independently of page gating.
  const manifest = JSON.parse(await readFile(".next-test/dev/server/server-reference-manifest.json", "utf8"));
  const entries = Object.entries(manifest.node) as [string, { exportedName?: string; workers: Record<string, { moduleId: string | number; async: boolean }> }][];
  const found = entries.find(([, action]) => action.exportedName === "mutateReference");
  if (!found) throw new Error("mutateReference missing from test server action manifest");
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
    assert.match(account, /No has iniciado sesión/);
  } finally { identity.restoreOwner(); }
});
