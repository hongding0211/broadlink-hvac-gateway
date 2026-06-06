import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { AliasStore } from "./aliasStore.js";
import { fans, HvacClient, modes } from "./hvacClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../../dist");
const client = new HvacClient(config);
const aliases = new AliasStore();
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, gateway: config.host });
});

app.get("/api/options", (_req, res) => {
  res.json({ modes, fans });
});

app.get("/api/units", async (_req, res) => {
  res.json({ units: await aliases.apply(await client.readUnits()) });
});

app.patch("/api/units/:idx", async (req, res) => {
  const result = await client.updateUnit(Number(req.params.idx), req.body || {});
  res.json(result);
});

app.put("/api/units/:idx/alias", async (req, res) => {
  const result = await aliases.set(Number(req.params.idx), req.body?.alias);
  res.json(result);
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use(express.static(distDir));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: error.message || "Internal server error",
    details: error.deviceResponse
  });
});

app.listen(config.listenPort, config.listenHost, () => {
  console.log(`HVAC gateway UI listening on http://${config.listenHost}:${config.listenPort}`);
  console.log(`Target BroadLink gateway: ${config.host}:${config.port}`);
});
