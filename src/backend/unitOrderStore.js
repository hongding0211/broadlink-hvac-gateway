import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export class UnitOrderStore {
  constructor(dataDir = process.env.HVAC_DATA_DIR || path.join(root, ".data")) {
    this.filePath = path.join(dataDir, "unit-order.json");
  }

  async get() {
    return this.read();
  }

  async set(unitIdxs) {
    const order = normalizeOrder(unitIdxs);
    await this.write(order);
    return order;
  }

  async apply(units) {
    const order = await this.read();
    if (order.length === 0) return units;

    const rank = new Map(order.map((unitIdx, index) => [unitIdx, index]));
    return [...units].sort((left, right) => {
      const leftRank = rank.has(left.idx) ? rank.get(left.idx) : Number.MAX_SAFE_INTEGER;
      const rightRank = rank.has(right.idx) ? rank.get(right.idx) : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.idx - right.idx;
    });
  }

  async read() {
    try {
      return normalizeOrder(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async write(order) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(order, null, 2), "utf8");
  }
}

function normalizeOrder(value) {
  if (!Array.isArray(value)) throw statusError(400, "Unit order is invalid");
  const order = [];
  const seen = new Set();

  for (const item of value) {
    const unitIdx = Number(item);
    if (!Number.isInteger(unitIdx) || unitIdx < 0) throw statusError(400, "Unit order contains an invalid unit");
    if (seen.has(unitIdx)) continue;
    seen.add(unitIdx);
    order.push(unitIdx);
  }

  return order;
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
