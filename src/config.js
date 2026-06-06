import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadDotEnv();

const requiredHost = process.env.HVAC_HOST;

if (!requiredHost) {
  throw new Error("HVAC_HOST is required. Example: HVAC_HOST=192.168.x.x npm start");
}

export const config = {
  host: requiredHost,
  port: Number(process.env.HVAC_PORT || 80),
  username: process.env.HVAC_USER || "admin",
  password: process.env.HVAC_PASSWORD || "",
  requestTimeoutMs: Number(process.env.HVAC_TIMEOUT_MS || 5000),
  listenHost: process.env.HOST || "0.0.0.0",
  listenPort: Number(process.env.PORT || 3000),
  maxStatusPages: Number(process.env.HVAC_MAX_STATUS_PAGES || 64)
};

function loadDotEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
