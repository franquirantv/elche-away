import { createServer } from "node:http";
import { once } from "node:events";

// In-memory S3 wire fixture: real AWS SDK, no external storage or auth bypass.
export async function storageFixture() {
  const objects = new Map<string, Buffer>();
  let writes = 0;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const key = url.pathname.replace(/^\/elche-away-test\//, "");
    const signed = request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ");
    if (["PUT", "DELETE"].includes(request.method || "") && !signed) { response.writeHead(403); response.end(); return; }
    if (request.method === "PUT") {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objects.set(key, Buffer.concat(chunks)); writes++;
      response.writeHead(200, { ETag: '"synthetic"' }); response.end();
    } else if (request.method === "DELETE") {
      objects.delete(key); writes++; response.writeHead(204); response.end();
    } else if (request.method === "GET" && objects.has(key)) {
      response.writeHead(200, { "Content-Type": "image/webp" }); response.end(objects.get(key));
    } else { response.writeHead(404, { "Content-Type": "application/xml" }); response.end("<Error><Code>NoSuchKey</Code></Error>"); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing S3 fixture port.");
  return { endpoint: `http://127.0.0.1:${address.port}`, objects, writes: () => writes, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
