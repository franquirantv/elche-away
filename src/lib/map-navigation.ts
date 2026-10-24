export type MapView = "summary" | "trips" | "stadiums";
export type MapSelection = { kind: "map" } | { kind: "view"; view: MapView } | { kind: "stadium" | "trip"; slug: string } | { kind: "invalid" };

export function mapSelection(params: Record<string, string | string[] | undefined>): MapSelection {
  const entries = ["view", "stadium", "trip"].filter((key) => params[key] !== undefined);
  if (!entries.length) return { kind: "map" };
  if (entries.length !== 1) return { kind: "invalid" };
  const key = entries[0];
  const value = params[key];
  if (typeof value !== "string" || !value || value.length > 200) return { kind: "invalid" };
  if (key === "view") return ["summary", "trips", "stadiums"].includes(value) ? { kind: "view", view: value as MapView } : { kind: "invalid" };
  return { kind: key as "stadium" | "trip", slug: value };
}

export function mapDetailHref(kind: "stadium" | "trip", slug: string) {
  return `/?${kind}=${encodeURIComponent(slug)}`;
}
