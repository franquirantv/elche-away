import { territorialProgress } from "@/lib/geography";

export function TerritorialSummary({ stadiums }: { stadiums: { visits: number; provinceCode: string | null }[] }) {
  const progress = territorialProgress(stadiums);
  return <section aria-labelledby="territorial-title" className="territorial-summary">
    <h3 id="territorial-title">Territorios de mis visitas</h3>
    <p>Geografía conocida: {progress.knownStadiums} de {progress.visitedStadiums} estadios visitados. Las visitas repetidas cuentan una sola vez por territorio.</p>
    {[{ label: "Provincias", items: progress.provinces }, { label: "Comunidades autónomas", items: progress.communities }].map(({ label, items }) => {
      const visited = items.filter((item) => item.visited).length;
      return <div key={label}>
        <p><strong>{label}: {visited} de {items.length} · {Math.round(visited / items.length * 100)} %</strong></p>
        <progress aria-label={label} value={visited} max={items.length}>{visited} de {items.length}</progress>
        <details><summary>Ver territorios visitados y pendientes</summary><ul className="territory-list">{items.map((item) => <li key={item.name}>{item.visited ? "✓ Visitado" : "○ Pendiente"} · {item.name}</li>)}</ul></details>
      </div>;
    })}
    <p>Ciudades autónomas: {progress.cities.map((city) => `${city.name}: ${city.visited ? "visitada" : "pendiente"}`).join(" · ")}.</p>
    <p>Incluye Baleares y Canarias. Los porcentajes indican territorios con al menos un estadio visitado, no superficie ni porcentaje de España recorrida. Ceuta y Melilla se muestran aparte. No se calculan kilómetros.</p>
  </section>;
}
