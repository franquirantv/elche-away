import "./env";
import { spawn } from "node:child_process";
import { localDatabaseUrl } from "../src/db/environment";

function main() {
  const database = localDatabaseUrl("testing");
  const baseUrl = process.env.TEST_NEON_AUTH_BASE_URL;
  const secret = process.env.TEST_NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32 || baseUrl === process.env.NEON_AUTH_BASE_URL || secret === process.env.NEON_AUTH_COOKIE_SECRET) {
    throw new Error("Configure isolated testing auth URL and cookie secret in .env.local.");
  }
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost", "--port", "3001"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: database, NEON_AUTH_BASE_URL: baseUrl, NEON_AUTH_COOKIE_SECRET: secret, ADMIN_USER_ID: process.env.TEST_ADMIN_USER_ID ?? "", ARCHIVE_TEST_SERVER: "manual" },
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
  child.on("error", () => { console.error("No se pudo iniciar el entorno de testing."); process.exitCode = 1; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
}
try { main(); } catch { console.error("Revisa la configuración de testing según README.md. No se han mostrado credenciales."); process.exitCode = 1; }
