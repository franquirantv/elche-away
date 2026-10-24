import { redirect } from "next/navigation";

// Keep the existing entry point and shared selections usable after moving home.
export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.set(key, value);
  }
  redirect(query.size ? `/?${query}` : "/");
}
