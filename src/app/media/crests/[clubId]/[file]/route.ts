import { getDatabase } from "@/db/client";
import { publishedCrest } from "@/db/club-crests";
import { isCrestKey } from "@/lib/crest-key";
import { storageConfig } from "@/server/storage-config";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string; file: string }> }) {
  const { clubId, file } = await params;
  const key = `crests/${clubId}/${file}`;
  const failed = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!isCrestKey(key)) return failed(404);
  try {
    if (!await publishedCrest(getDatabase(), key)) return failed(404);
    const config = storageConfig();
    // Only canonical, current crest keys at our own configured public origin.
    const image = await fetch(`${config.endpoint}/${config.bucket}/${key}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!image.ok) return failed(image.status === 404 ? 404 : 503);
    if (image.headers.get("Content-Type")?.split(";")[0] !== "image/webp") return failed(503);
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 1_000_000) return failed(503);
    return new Response(bytes, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return failed(503); }
}
