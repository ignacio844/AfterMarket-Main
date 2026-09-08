import { createServer } from "node:http";

const host = process.env.GATEWAY_HOST ?? "127.0.0.1";
const port = Number(process.env.GATEWAY_PORT ?? 8790);
const routes = [
  { path: "/wms-trace", upstream: "http://127.0.0.1:8787" },
  { path: "/executive/daily-lines", upstream: "http://127.0.0.1:8788" },
  { path: "/executive/brand-lines", upstream: "http://127.0.0.1:8788" },
];

function respond(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function upstreamHealth(url) {
  try {
    const result = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) });
    return result.ok;
  } catch {
    return false;
  }
}

async function proxyRequest(request, response, route, sourceUrl) {
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, route.upstream);
  const headers = new Headers(request.headers);
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("host");

  const upstreamResponse = await fetch(targetUrl, {
    method: "GET",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const body = Buffer.from(await upstreamResponse.arrayBuffer());

  response.writeHead(upstreamResponse.status, {
    "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const sourceUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && sourceUrl.pathname === "/health") {
    const [auditBridge, executiveBridge] = await Promise.all([
      upstreamHealth("http://127.0.0.1:8787"),
      upstreamHealth("http://127.0.0.1:8788"),
    ]);
    return respond(response, 200, {
      status: "ok",
      upstreams: { auditBridge, executiveBridge },
    });
  }

  if (request.method !== "GET") return respond(response, 405, { error: "METHOD_NOT_ALLOWED" });
  const route = routes.find((candidate) => candidate.path === sourceUrl.pathname);
  if (!route) return respond(response, 404, { error: "NOT_FOUND" });

  try {
    await proxyRequest(request, response, route, sourceUrl);
  } catch (error) {
    console.error(`No se pudo comunicar con ${route.upstream}:`, error);
    respond(response, 502, { error: "UPSTREAM_UNAVAILABLE" });
  }
});

server.listen(port, host, () => {
  console.log(`Bridge Gateway escuchando en http://${host}:${port}`);
});

function shutdown() {
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
