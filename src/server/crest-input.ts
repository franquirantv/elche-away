import sharp from "sharp";
export const MAX_CREST_BYTES = 1_000_000;
export class InvalidCrest extends Error {}
export async function normalizeCrest(file: File): Promise<Buffer> {
  if (!file.size || file.size > MAX_CREST_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new InvalidCrest("Selecciona un PNG, JPEG o WebP de hasta 1 MB.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 16_777_216, failOn: "warning" });
    const metadata = await image.metadata();
    const expected = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[file.type];
    if (metadata.format !== expected || (metadata.pages ?? 1) !== 1) throw new Error();
    // No keepMetadata/withMetadata: re-encoding strips EXIF, ICC and XMP.
    const output = await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).timeout({ seconds: 10 }).toBuffer();
    if (output.length > MAX_CREST_BYTES) throw new Error();
    return output;
  } catch { throw new InvalidCrest("La imagen no es válida o supera los límites de dimensiones. No se admiten SVG ni imágenes animadas."); }
}

export async function readCrestForm(request: Request): Promise<FormData> {
  const max = MAX_CREST_BYTES + 65_536;
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidCrest("Falta el formulario.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > max) { await reader.cancel(); throw new InvalidCrest("El formulario supera el tamaño permitido (imagen de hasta 1 MB)."); }
      chunks.push(chunk.value);
    }
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch (error) {
    if (error instanceof InvalidCrest) throw error;
    throw new InvalidCrest("Formulario de escudo no válido.");
  }
}
