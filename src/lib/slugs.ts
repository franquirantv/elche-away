export function slugBase(label: string) {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160).replace(/-$/, "") || "viaje";
}

// Unique constraints remain the final authority on concurrent collisions.
export async function availableSlug(label: string, exists: (candidate: string) => Promise<boolean>) {
  const base = slugBase(label);
  let candidate = base;
  for (let suffix = 2; await exists(candidate); suffix++) {
    const ending = `-${suffix}`;
    candidate = `${base.slice(0, 160 - ending.length).replace(/-$/, "")}${ending}`;
  }
  return candidate;
}
