import http from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { AliasStore } from "./aliasStore.js";
import { fans, HvacClient, modes } from "./hvacClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const client = new HvacClient(config);
const aliases = new AliasStore();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true, gateway: config.host });
    }

    if (url.pathname === "/api/options" && req.method === "GET") {
      return sendJson(res, 200, { modes, fans });
    }

    if (url.pathname === "/api/units" && req.method === "GET") {
      return sendJson(res, 200, { units: await aliases.apply(await client.readUnits()) });
    }

    const unitMatch = url.pathname.match(/^\/api\/units\/(\d+)$/);
    if (unitMatch && req.method === "PATCH") {
      const body = await readJsonBody(req);
      const result = await client.updateUnit(Number(unitMatch[1]), body);
      return sendJson(res, 200, result);
    }

    const aliasMatch = url.pathname.match(/^\/api\/units\/(\d+)\/alias$/);
    if (aliasMatch && req.method === "PUT") {
      const body = await readJsonBody(req);
      const result = await aliases.set(Number(aliasMatch[1]), body.alias);
      return sendJson(res, 200, result);
    }

    return serveStatic(req, res, url.pathname);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, {
      error: error.message || "Internal server error",
      details: error.deviceResponse
    });
  }
});

server.listen(config.listenPort, config.listenHost, () => {
  console.log(`HVAC gateway UI listening on http://${config.listenHost}:${config.listenPort}`);
  console.log(`Target BroadLink gateway: ${config.host}:${config.port}`);
});

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDir, `.${safePath}`);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    await readFile(filePath);
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentType(filePath) });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}
