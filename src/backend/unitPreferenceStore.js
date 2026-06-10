import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validModes = new Set([0, 1, 2, 3, 4, 5, 6, 8, 9, 10]);
const validFans = new Set([0, 1, 2, 4, 6]);
const preferenceKeys = ["mode", "tempSet", "fan", "FlowDirection1", "FlowDirection2"];

export class UnitPreferenceStore {
  constructor(dataDir = process.env.HVAC_DATA_DIR || path.join(root, ".data")) {
    this.filePath = path.join(dataDir, "unit-preferences.json");
  }

  async list() {
    const preferences = await this.read();
    return Object.entries(preferences)
      .map(([unitIdx, patch]) => ({ unitIdx: Number(unitIdx), patch }))
      .sort((left, right) => left.unitIdx - right.unitIdx);
  }

  async get(unitIdx) {
    const normalizedUnitIdx = normalizeUnitIdx(unitIdx);
    const preferences = await this.read();
    return preferences[String(normalizedUnitIdx)] || {};
  }

  async setPatch(unitIdx, patch) {
    const normalizedUnitIdx = normalizeUnitIdx(unitIdx);
    const normalizedPatch = normalizePreferencePatch(patch);
    const preferences = await this.read();
    const currentPatch = preferences[String(normalizedUnitIdx)] || {};
    const nextPatch = { ...currentPatch, ...normalizedPatch };
    preferences[String(normalizedUnitIdx)] = nextPatch;
    await this.write(preferences);
    return { unitIdx: normalizedUnitIdx, patch: nextPatch };
  }

  async read() {
    try {
      const preferences = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return {};

      return Object.fromEntries(
        Object.entries(preferences).map(([unitIdx, patch]) => [String(normalizeUnitIdx(unitIdx)), normalizePreferencePatch(patch)])
      );
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  async write(preferences) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(preferences, null, 2), "utf8");
  }
}

export function pickPreferencePatch(input) {
  if (!input || typeof input !== "object") return {};

  const patch = {};
  for (const key of preferenceKeys) {
    if (Object.hasOwn(input, key)) patch[key] = input[key];
  }
  return normalizePreferencePatch(patch);
}

function normalizePreferencePatch(value) {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "object" || Array.isArray(value)) throw statusError(400, "Preference patch is invalid");

  const patch = {};

  if (Object.hasOwn(value, "mode")) {
    const mode = Number(value.mode);
    if (!Number.isInteger(mode) || !validModes.has(mode)) throw statusError(400, "Preference mode is invalid");
    patch.mode = mode;
  }

  if (Object.hasOwn(value, "fan")) {
    const fan = Number(value.fan);
    if (!Number.isInteger(fan) || !validFans.has(fan)) throw statusError(400, "Preference fan is invalid");
    patch.fan = fan;
  }

  if (Object.hasOwn(value, "tempSet")) {
    const tempSet = Number(value.tempSet);
    if (!Number.isInteger(tempSet) || tempSet < 16 || tempSet > 32) throw statusError(400, "Preference temperature is invalid");
    patch.tempSet = tempSet;
  }

  if (Object.hasOwn(value, "FlowDirection1")) {
    const flowDirection1 = Number(value.FlowDirection1);
    if (!Number.isInteger(flowDirection1) || flowDirection1 < 0 || flowDirection1 > 7) throw statusError(400, "Preference airflow is invalid");
    patch.FlowDirection1 = flowDirection1;
  }

  if (Object.hasOwn(value, "FlowDirection2")) {
    const flowDirection2 = Number(value.FlowDirection2);
    if (!Number.isInteger(flowDirection2) || flowDirection2 < 0 || flowDirection2 > 6) throw statusError(400, "Preference airflow is invalid");
    patch.FlowDirection2 = flowDirection2;
  }

  return patch;
}

function normalizeUnitIdx(value) {
  const unitIdx = Number(value);
  if (!Number.isInteger(unitIdx) || unitIdx < 0) throw statusError(400, "Preference unit is invalid");
  return unitIdx;
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
