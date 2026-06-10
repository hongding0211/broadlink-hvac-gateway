import express from "express";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { AliasStore } from "./aliasStore.js";
import { AutomationRunner } from "./automationRunner.js";
import { AutomationStore } from "./automationStore.js";
import { fans, HvacClient, modes } from "./hvacClient.js";
import { UnitOrderStore } from "./unitOrderStore.js";
import { pickPreferencePatch, UnitPreferenceStore } from "./unitPreferenceStore.js";
import { UnitTimerRunner } from "./unitTimerRunner.js";
import { UnitTimerStore } from "./unitTimerStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../../dist");
const client = new HvacClient(config);
const aliases = new AliasStore();
const automations = new AutomationStore();
const automationRunner = new AutomationRunner({ store: automations, client });
const unitTimers = new UnitTimerStore();
const unitPreferences = new UnitPreferenceStore();
const unitOrder = new UnitOrderStore();
const unitTimerRunner = new UnitTimerRunner({ store: unitTimers, client, preferences: unitPreferences });
const app = express();

app.disable("x-powered-by");
app.use(requireAccessToken);
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, gateway: config.host });
});

app.get("/api/options", (_req, res) => {
  res.json({ modes, fans });
});

app.get("/api/units", async (_req, res) => {
  res.json({ units: await unitOrder.apply(await aliases.apply(await client.readUnits())) });
});

app.patch("/api/units/:idx", async (req, res) => {
  const result = await client.updateUnit(Number(req.params.idx), req.body || {});
  const preferencePatch = pickPreferencePatch(req.body || {});
  if (Object.keys(preferencePatch).length > 0) {
    await unitPreferences.setPatch(Number(req.params.idx), preferencePatch);
  }
  res.json(result);
});

app.get("/api/unit-preferences", async (_req, res) => {
  res.json({ preferences: await unitPreferences.list() });
});

app.patch("/api/units/:idx/preferences", async (req, res) => {
  const preference = await unitPreferences.setPatch(Number(req.params.idx), req.body || {});
  res.json({ preference });
});

app.get("/api/unit-order", async (_req, res) => {
  res.json({ order: await unitOrder.get() });
});

app.put("/api/unit-order", async (req, res) => {
  const order = await unitOrder.set(req.body?.order);
  res.json({ order });
});

app.put("/api/units/:idx/alias", async (req, res) => {
  const result = await aliases.set(Number(req.params.idx), req.body?.alias);
  res.json(result);
});

app.get("/api/unit-timers", async (_req, res) => {
  res.json({ timers: await unitTimers.list() });
});

app.put("/api/units/:idx/timers/:action", async (req, res) => {
  const timer = await unitTimers.set(Number(req.params.idx), req.params.action, req.body?.runAt, req.body?.presetMinutes, req.body?.patch);
  res.json({ timer });
});

app.delete("/api/units/:idx/timers/:action", async (req, res) => {
  const result = await unitTimers.delete(Number(req.params.idx), req.params.action);
  res.json(result);
});

app.get("/api/automations", async (_req, res) => {
  res.json({ automations: await automations.list() });
});

app.post("/api/automations", async (req, res) => {
  const automation = await automations.create(req.body || {});
  res.status(201).json({ automation });
});

app.patch("/api/automations/:id", async (req, res) => {
  const automation = await automations.update(req.params.id, req.body || {});
  res.json({ automation });
});

app.delete("/api/automations/:id", async (req, res) => {
  const result = await automations.delete(req.params.id);
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
  automationRunner.start();
  unitTimerRunner.start();
});

function requireAccessToken(req, res, next) {
  if (!config.appAccessToken) return next();

  const queryToken = firstString(req.query?.token || req.query?.password || req.query?.key);
  const cookieToken = getCookie(req, "hvac_access");
  const token = queryToken || cookieToken;

  if (token && safeEqual(token, config.appAccessToken)) {
    if (queryToken) {
      res.setHeader("Set-Cookie", `hvac_access=${encodeURIComponent(queryToken)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`);
    }
    return next();
  }

  return accessDenied(res);
}

function accessDenied(res) {
  return res.status(401).send("Access token required");
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function firstString(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : "";
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
}
