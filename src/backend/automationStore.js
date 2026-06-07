import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validDays = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export class AutomationStore {
  constructor(dataDir = process.env.HVAC_DATA_DIR || path.join(root, ".data")) {
    this.filePath = path.join(dataDir, "automations.json");
  }

  async list() {
    return this.read();
  }

  async create(input) {
    const automations = await this.read();
    const automation = normalizeAutomation({
      ...input,
      id: randomUUID(),
      enabled: input?.enabled !== false
    });

    automations.unshift(automation);
    await this.write(automations);
    return automation;
  }

  async update(id, patch) {
    const automations = await this.read();
    const index = automations.findIndex((automation) => automation.id === id);
    if (index === -1) throw statusError(404, "Automation not found");

    const automation = normalizeAutomation({ ...automations[index], ...patch, id });
    automations[index] = automation;
    await this.write(automations);
    return automation;
  }

  async delete(id) {
    const automations = await this.read();
    const nextAutomations = automations.filter((automation) => automation.id !== id);
    if (nextAutomations.length === automations.length) throw statusError(404, "Automation not found");

    await this.write(nextAutomations);
    return { id };
  }

  async read() {
    try {
      const automations = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(automations) ? automations.map(normalizeAutomation) : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async write(automations) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(automations, null, 2), "utf8");
  }
}

function normalizeAutomation(input) {
  const id = String(input?.id || "").trim();
  const name = String(input?.name || "").trim();
  const time = String(input?.time || "").trim();
  const days = normalizeDays(input?.days);
  const unitIdxs = normalizeUnitIdxs(input);
  const mode = Number(input?.mode);
  const fan = Number(input?.fan);
  const tempSet = Number(input?.tempSet);

  if (!id) throw statusError(400, "Automation id is required");
  if (!name) throw statusError(400, "Automation name is required");
  if (!isValidTime(time)) throw statusError(400, "Automation time is invalid");
  if (!Number.isInteger(mode)) throw statusError(400, "Automation mode is invalid");
  if (!Number.isInteger(fan)) throw statusError(400, "Automation fan is invalid");
  if (!Number.isInteger(tempSet) || tempSet < 16 || tempSet > 32) {
    throw statusError(400, "Automation temperature is invalid");
  }

  return {
    id,
    name: name.slice(0, 24),
    unitIdxs,
    unitIdx: unitIdxs[0],
    time,
    days,
    mode,
    fan,
    tempSet,
    enabled: input?.enabled !== false
  };
}

function normalizeUnitIdxs(input) {
  const rawUnitIdxs = Array.isArray(input?.unitIdxs) ? input.unitIdxs : [input?.unitIdx];
  const unitIdxs = rawUnitIdxs.map((unitIdx) => Number(unitIdx)).filter((unitIdx) => Number.isInteger(unitIdx) && unitIdx >= 0);
  const uniqueUnitIdxs = [...new Set(unitIdxs)];
  if (uniqueUnitIdxs.length === 0) throw statusError(400, "Automation unit is invalid");
  return uniqueUnitIdxs;
}

function normalizeDays(days) {
  if (!Array.isArray(days)) throw statusError(400, "Automation days are invalid");

  const normalizedDays = days.map((day) => String(day)).filter((day) => validDays.has(day));
  const uniqueDays = [...new Set(normalizedDays)];
  if (uniqueDays.length === 0) throw statusError(400, "Automation days are invalid");
  return uniqueDays;
}

function isValidTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
