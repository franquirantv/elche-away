import { requireCondition } from "./policy";

export async function smoke(origin: string, bypass?: string) {
  const base = new URL(origin);
  requireCondition(base.protocol === "https:" && base.origin === origin && !base.username && !base.password, "SMOKE_ORIGIN");
  for (const [path, status, marker] of [["/", 200, "Donde tú"], ["/trips", 200, "Viajes"],
    ["/stadiums", 200, "Estadios"], ["/map", 200, "Mapa"], ["/__cd_missing_page__", 404, "No encontramos esta página"]] as const) {
    let passed = false;
    for (let attempt = 0; attempt < 3 && !passed; attempt++) {
      try {
        const response = await fetch(new URL(path, base), {
          redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
          headers: bypass ? { "x-vercel-protection-bypass": bypass } : {},
        });
        const body = await response.text();
        passed = response.status === status && /<html[^>]*lang="es"/.test(body)
          && /Elche|elche/.test(body) && body.includes(marker)
          && !/No podemos cargar esta página|El archivo no está disponible|Application error|Internal Server Error/i.test(body);
      } catch { /* Retry bounded read-only requests; never print response content. */ }
      if (!passed) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    requireCondition(passed, "SMOKE_FAILED");
  }
}
