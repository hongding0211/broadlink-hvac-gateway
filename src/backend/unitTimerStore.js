import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validActions = new Set(["on", "off"]);

export class UnitTimerStore {
  constructor(dataDir = process.env.HVAC_DATA_DIR || path.join(root, ".data")) {
    this.filePath = path.join(dataDir, "unit-timers.json");
  }

  async list() {
    return this.read();
  }

  async set(unitIdx, action, runAt, presetMinutes) {
    const timer = normalizeTimer({ unitIdx, action, runAt, presetMinutes });
    const timers = await this.read();
    const nextTimers = timers.filter((item) => item.unitIdx !== timer.unitIdx || item.action !== timer.action);
    nextTimers.push(timer);
    nextTimers.sort((left, right) => left.runAt.localeCompare(right.runAt));
    await this.write(nextTimers);
    return timer;
  }

  async delete(unitIdx, action) {
    const normalizedUnitIdx = normalizeUnitIdx(unitIdx);
    const normalizedAction = normalizeAction(action);
    const timers = await this.read();
    const nextTimers = timers.filter((timer) => timer.unitIdx !== normalizedUnitIdx || timer.action !== normalizedAction);
    await this.write(nextTimers);
    return { unitIdx: normalizedUnitIdx, action: normalizedAction };
  }

  async read() {
    try {
      const timers = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(timers) ? timers.map(normalizeTimer) : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async write(timers) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(timers, null, 2), "utf8");
  }
}

function normalizeTimer(input) {
  const unitIdx = normalizeUnitIdx(input?.unitIdx);
  const action = normalizeAction(input?.action);
  const runAt = normalizeRunAt(input?.runAt);
  const presetMinutes = normalizePresetMinutes(input?.presetMinutes);

  const timer = {
    id: `${unitIdx}:${action}`,
    unitIdx,
    action,
    runAt
  };

  if (presetMinutes !== null) {
    timer.presetMinutes = presetMinutes;
  }

  return timer;
}

function normalizeUnitIdx(value) {
  const unitIdx = Number(value);
  if (!Number.isInteger(unitIdx) || unitIdx < 0) throw statusError(400, "Timer unit is invalid");
  return unitIdx;
}

function normalizeAction(value) {
  const action = String(value || "");
  if (!validActions.has(action)) throw statusError(400, "Timer action is invalid");
  return action;
}

function normalizeRunAt(value) {
  const runAt = new Date(String(value || ""));
  if (Number.isNaN(runAt.getTime())) throw statusError(400, "Timer time is invalid");
  return runAt.toISOString();
}

function normalizePresetMinutes(value) {
  if (value === undefined || value === null || value === "") return null;

  const presetMinutes = Number(value);
  if (!Number.isInteger(presetMinutes) || presetMinutes <= 0 || presetMinutes > 24 * 60) {
    throw statusError(400, "Timer preset is invalid");
  }

  return presetMinutes;
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
