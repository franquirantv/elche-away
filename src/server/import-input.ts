import { createHash } from "node:crypto";

export class ImportError extends Error {}
export const MAX_IMPORT_BYTES = 350_000;
export const IMPORT_BATCH_SIZE = 40;
export type SourceRecord = {
  home: string; away: string; playedOn: string | null; homeScore: number | null; awayScore: number | null;
  phase: string | null;
};
export type ImportInput = {
  repository: "openfootball/football.json" | "openfootball/espana";
  path: string; revision: string; content: string; format: "json" | "txt";
  seasonId: string; competitionId: string; elcheName: string; offset: number;
  resultsConfirmed: boolean; mappings: Record<string, string>; targets: Record<string, string>;
};
export function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
const text = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new ImportError("Nombre o fase no válido en el archivo.");
  return value.trim().normalize("NFC");
};
function exactDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000") || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ImportError("Fecha no válida; no se admiten fechas parciales.");
  return value;
}
function score(value: unknown): [number | null, number | null] {
  if (value == null) return [null, null];
  if (!Array.isArray(value) || value.length !== 2 || value.some((n) => !Number.isInteger(n) || n < 0 || n > 1000)) throw new ImportError("Marcador no compatible: se necesitan dos goles enteros, sin sumar la tanda.");
  return [value[0] as number, value[1] as number];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ImportError("Estructura JSON no compatible.");
  return value as Record<string, unknown>;
}
function jsonRecords(content: string): SourceRecord[] {
  let data: unknown;
  try { data = JSON.parse(content); } catch { throw new ImportError("JSON no válido."); }
  let rows: unknown[];
  if (Array.isArray(data)) rows = data;
  else {
    const root = object(data);
    if (Array.isArray(root.matches)) rows = root.matches;
    else if (Array.isArray(root.rounds)) rows = root.rounds.flatMap((r) => {
      const round = object(r);
      if (!Array.isArray(round.matches)) throw new ImportError("Jornada JSON sin partidos compatibles.");
      return round.matches.map((m) => ({ ...object(m), round: round.name }));
    });
    else throw new ImportError("JSON compatible: lista de partidos, matches o rounds con matches.");
  }
  if (rows.length > 2000) throw new ImportError("Máximo 2000 registros por archivo.");
  return rows.map((value) => {
    const row = object(value);
    // An explicit extra-time score takes priority. Never use penalty kicks.
    const scores = row.score == null || Array.isArray(row.score) ? row.score : object(row.score);
    const pair = scores && !Array.isArray(scores) ? (scores.et ?? scores.ft) : scores;
    const [homeScore, awayScore] = score(pair);
    return { home: text(row.team1), away: text(row.team2), playedOn: exactDate(row.date), homeScore, awayScore, phase: row.round == null ? null : text(row.round) };
  });
}
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function txtRecords(content: string): SourceRecord[] {
  const heading = content.match(/^= .*?(\d{4})\/(?:\d{2}|\d{4})\s*$/m);
  if (!heading) throw new ImportError("Football.TXT necesita cabecera con temporada YYYY/YY.");
  const start = Number(heading[1]);
  let year = start, playedOn: string | null = null, phase: string | null = null;
  const records: SourceRecord[] = [];
  for (const [index, original] of content.split(/\r?\n/).entries()) {
    const line = original.trim();
    if (!line || line.startsWith("#") || line.startsWith("=")) continue;
    if (line.startsWith("▪")) { phase = text(line.slice(1)); playedOn = null; continue; }
    const date = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?: (\d{4}))?$/);
    if (date) {
      const month = monthNames.indexOf(date[1]) + 1;
      if (date[3]) year = Number(date[3]);
      else if (month < 7 && year === start) year = start + 1;
      playedOn = exactDate(`${year}-${String(month).padStart(2, "0")}-${date[2].padStart(2, "0")}`);
      continue;
    }
    const body = line.replace(/^\d{1,2}:\d{2}\s+/, "");
    let home: string, away: string, result: string;
    const versus = body.match(/^(.+?)\s+v\s+(.+?)(?:\s{2,}(.+))?$/);
    if (versus) { home = versus[1]; away = versus[2]; result = versus[3] ?? ""; }
    else {
      const middle = body.match(/^(.+?)\s{2,}(\d+-\d+(?:\s+pen\.\s+\d+-\d+)?(?:\s+a\.e\.t\.)?(?:\s+\([^)]*\))?)\s{2,}(.+)$/);
      if (!middle) throw new ImportError(`Línea ${index + 1} de Football.TXT no compatible. No se ha importado ningún registro.`);
      home = middle[1]; result = middle[2]; away = middle[3];
    }
    let homeScore: number | null = null, awayScore: number | null = null;
    if (result) {
      const parsed = result.match(/^(?:\d+-\d+\s+pen\.\s+)?(\d+)-(\d+)(?:\s+a\.e\.t\.)?(?:\s+\([^)]*\))?$/);
      if (!parsed) throw new ImportError(`Resultado no compatible en la línea ${index + 1}.`);
      [homeScore, awayScore] = score([Number(parsed[1]), Number(parsed[2])]);
    }
    records.push({ home: text(home), away: text(away), playedOn, homeScore, awayScore, phase });
    if (records.length > 2000) throw new ImportError("Máximo 2000 registros por archivo.");
  }
  return records;
}
export function parseImport(input: ImportInput) {
  if (Buffer.byteLength(input.content, "utf8") > MAX_IMPORT_BYTES || !input.content.trim()) throw new ImportError("Selecciona un archivo de hasta 350000 bytes.");
  if (!["openfootball/football.json", "openfootball/espana"].includes(input.repository) || !/^[a-zA-Z0-9/_().-]{1,200}$/.test(input.path) || input.path.split("/").some((p) => p === "..") || !/^[a-f0-9]{40}$/.test(input.revision)) throw new ImportError("Indica repositorio OpenFootball, ruta relativa y revisión Git completa de 40 caracteres.");
  if (!["json", "txt"].includes(input.format) || !Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 2000) throw new ImportError("Formato o inicio de lote no válido.");
  const records = input.format === "json" ? jsonRecords(input.content) : txtRecords(input.content);
  if (!records.length) throw new ImportError("El archivo no contiene partidos compatibles.");
  return records;
}
export function selectedRecords(input: ImportInput) {
  const records = parseImport(input).filter((r) => r.home === input.elcheName || r.away === input.elcheName);
  if (!records.length || input.offset >= records.length) throw new ImportError("No hay partidos para el nombre exacto de Elche y el inicio de lote seleccionados.");
  const batch = records.slice(input.offset, input.offset + IMPORT_BATCH_SIZE);
  const fingerprints = batch.map((r) => digest(r));
  if (new Set(fingerprints).size !== batch.length) throw new ImportError("El lote contiene registros idénticos duplicados; revisa el archivo.");
  return { total: records.length, records: batch };
}

export function decodeImportInput(value: unknown): ImportInput {
  const row = object(value);
  for (const name of ["repository", "path", "revision", "content", "format", "seasonId", "competitionId", "elcheName"]) {
    if (typeof row[name] !== "string") throw new ImportError("Entrada de importación no válida.");
  }
  if (typeof row.offset !== "number" || typeof row.resultsConfirmed !== "boolean") throw new ImportError("Opciones de importación no válidas.");
  const dictionary = (value: unknown) => {
    const entries = Object.entries(object(value));
    if (entries.length > 200 || entries.some(([key, val]) => key.length > 200 || typeof val !== "string" || val.length > 200)) throw new ImportError("Asignaciones de importación no válidas.");
    return Object.fromEntries(entries) as Record<string, string>;
  };
  const input = { repository: row.repository, path: row.path, revision: row.revision, content: row.content, format: row.format, seasonId: row.seasonId, competitionId: row.competitionId, elcheName: text(row.elcheName), offset: row.offset, resultsConfirmed: row.resultsConfirmed, mappings: dictionary(row.mappings), targets: dictionary(row.targets) } as ImportInput;
  parseImport(input);
  return input;
}
