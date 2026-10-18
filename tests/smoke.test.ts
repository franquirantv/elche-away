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
import { matches } from "../src/db/schema";

let server: ReturnType<typeof spawn>;
let origin: string;
let output = "";

before(async () => {
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
  ], { env: { ...process.env, DATABASE_URL: localDatabaseUrl("testing"), ARCHIVE_TEST_SERVER: "1", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
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
  if (!server || server.exitCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const forceKill = setTimeout(() => server.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(forceKill); }
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
