import { ImportError, MAX_IMPORT_BYTES, parseImport, type SourceRecord } from "./import-input";

export const OPENFOOTBALL_REPOSITORIES = ["openfootball/football.json", "openfootball/espana"] as const;
export type OpenRepository = typeof OPENFOOTBALL_REPOSITORIES[number];
export type ObtainedFile = { repository: OpenRepository; path: string; revision: string; year: number; competition: string; records: SourceRecord[] };
export type CoverageEntry = { season: string; competition: string; status: "available" | "missing" | "no-elche" | "error" | "unverified"; message: string; repository?: OpenRepository; path?: string };
export type Acquisition = { files: ObtainedFile[]; coverage: CoverageEntry[]; revisions: Partial<Record<OpenRepository, string>>; startYear: number; endYear: number };
export const seasonLabel = (year: number) => `${year}/${String(year + 1).slice(-2)}`;
export function currentSeasonYear(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "numeric", timeZone: "Europe/Madrid" }).formatToParts(now);
  return Number(parts.find((p) => p.type === "year")!.value) - (Number(parts.find((p) => p.type === "month")!.value) < 7 ? 1 : 0);
}
export function validateRange(start: number, end: number) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 2017 || end < start || end > currentSeasonYear() + 1 || end - start > 19) throw new ImportError("Selecciona hasta 20 temporadas desde 2017/18, sin superar la próxima temporada.");
}
const competitions = [
  { name: "Primera División", json: "es.1.json", txt: "1-liga.txt" },
  { name: "Segunda División", json: "es.2.json", txt: "2-liga2.txt" },
  { name: "Copa del Rey", json: "es.cup.json", txt: "cup.txt" },
];
function dictionary(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ImportError("Respuesta de GitHub no válida.");
  return value as Record<string, unknown>;
}
async function boundedGet(url: string, limit: number, fetcher: typeof fetch) {
  // URLs are constructed internally from constant repositories and validated Git
  // objects/paths. Never follow an upstream redirect to another host/repository.
  let response: Response;
  try { response = await fetcher(url, { method: "GET", redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/vnd.github+json", "User-Agent": "Elche-Away-fixture-import", "X-GitHub-Api-Version": "2026-03-10" } }); }
  catch { throw new ImportError("Error de obtención: red, redirección o tiempo de espera de GitHub. No significa falta de cobertura."); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ImportError(`Error de obtención de GitHub (HTTP ${response.status}${response.status === 403 || response.status === 429 ? "; posible límite de acceso" : ""}). No significa falta de cobertura.`);
  }
  if (!response.body) throw new ImportError("Error de obtención: respuesta de GitHub vacía.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ImportError("Error de obtención: archivo o catálogo de GitHub demasiado grande."); }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("Error de obtención: descarga incompleta o codificación no válida.");
  } finally { reader.releaseLock(); }
}
async function catalog(repository: OpenRepository, fetcher: typeof fetch) {
  const ref = dictionary(JSON.parse(await boundedGet(`https://api.github.com/repos/${repository}/git/ref/heads/master`, 50_000, fetcher)));
  const commit = dictionary(ref.object);
  if (commit.type !== "commit" || typeof commit.sha !== "string" || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new ImportError("Error de obtención: revisión Git no válida.");
  const revision = commit.sha;
  const tree = dictionary(JSON.parse(await boundedGet(`https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`, 6_000_000, fetcher)));
  if (tree.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > 30_000) throw new ImportError("Error de obtención: catálogo truncado o no válido. No permite determinar cobertura.");
  const paths = new Set(tree.tree.flatMap((entry) => {
    const item = dictionary(entry);
    return item.type === "blob" && typeof item.path === "string" ? [item.path] : [];
  }));
  return { repository, revision, paths };
}
export async function obtainOpenFootball(startYear: number, endYear: number, fetcher: typeof fetch = fetch): Promise<Acquisition> {
  validateRange(startYear, endYear);
  const coverage: CoverageEntry[] = [], files: ObtainedFile[] = [];
  const revisions: Acquisition["revisions"] = {};
  const catalogs = await Promise.all(OPENFOOTBALL_REPOSITORIES.map(async (repository) => {
    try { const result = await catalog(repository, fetcher); revisions[repository] = result.revision; return result; }
    catch (error) {
      coverage.push({ season: "Rango solicitado", competition: "Catálogo", status: "error", repository, message: error instanceof ImportError ? error.message : "Error de obtención: catálogo de GitHub no válido." });
      return null;
    }
  }));
  const requests: { year: number; competition: string; repository: OpenRepository; revision: string; path: string; format: "json" | "txt" }[] = [];
  for (let year = startYear; year <= endYear; year++) {
    const directory = `${year}-${String(year + 1).slice(-2)}`;
    for (const competition of competitions) {
      const primary = catalogs[0], secondary = catalogs[1];
      const jsonPath = `${directory}/${competition.json}`, txtPath = `${directory}/${competition.txt}`;
      const chosen = primary?.paths.has(jsonPath) ? { ...primary, path: jsonPath, format: "json" as const } : secondary?.paths.has(txtPath) ? { ...secondary, path: txtPath, format: "txt" as const } : null;
      if (chosen) requests.push({ year, competition: competition.name, repository: chosen.repository, revision: chosen.revision, path: chosen.path, format: chosen.format });
      else coverage.push({ season: seasonLabel(year), competition: competition.name, status: catalogs.every(Boolean) ? "missing" : "error", message: catalogs.every(Boolean) ? "No hay archivo compatible en los catálogos consultados. Completar mediante 4a si corresponde." : "No se pudo comprobar la disponibilidad porque falló un catálogo." });
    }
    coverage.push({ season: seasonLabel(year), competition: "Segunda B / Primera Federación y otras categorías", status: "unverified", message: "El catálogo compatible no acredita estas categorías históricas. No se infiere que Elche no jugara; completar mediante 4a." });
    coverage.push({ season: seasonLabel(year), competition: "Playoffs / fases de ascenso", status: "unverified", message: "Los archivos de liga no garantizan todas las eliminatorias de ascenso. Revisar las fases y completar sus lagunas mediante 4a." });
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, requests.length) }, async () => {
    while (cursor < requests.length) {
      const request = requests[cursor++];
      try {
        const content = await boundedGet(`https://raw.githubusercontent.com/${request.repository}/${request.revision}/${request.path}`, MAX_IMPORT_BYTES, fetcher);
        const records = parseImport({ ...request, content, offset: 0 }).filter((r) => r.home === "Elche CF" || r.away === "Elche CF");
        files.push({ ...request, records });
        coverage.push({ season: seasonLabel(request.year), competition: request.competition, status: records.length ? "available" : "no-elche", repository: request.repository, path: request.path, message: records.length ? `${records.length} registros del Elche; cobertura parcial, no certifica todas las fases ni resultados.` : "Archivo leído sin registros con el nombre exacto Elche CF; no prueba ausencia de partidos." });
      } catch (error) {
        coverage.push({ season: seasonLabel(request.year), competition: request.competition, status: "error", repository: request.repository, path: request.path, message: error instanceof ImportError ? error.message : "Error de obtención o formato no compatible." });
      }
    }
  }));
  return { startYear, endYear, files: files.sort((a, b) => a.year - b.year || a.competition.localeCompare(b.competition)), coverage: coverage.sort((a, b) => a.season.localeCompare(b.season) || a.competition.localeCompare(b.competition)), revisions };
}
