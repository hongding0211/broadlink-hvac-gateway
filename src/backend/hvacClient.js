import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MODE_LABELS = {
  0: "自动",
  1: "制冷",
  2: "除湿",
  3: "清爽",
  4: "新风",
  5: "自动除湿",
  6: "贴心睡眠",
  8: "制热",
  9: "地暖",
  10: "强热"
};

const FAN_LABELS = {
  0: "自动",
  1: "高风",
  2: "中风",
  4: "低风",
  6: "微风"
};

export const modes = Object.entries(MODE_LABELS).map(([value, label]) => ({
  value: Number(value),
  label
}));

export const fans = Object.entries(FAN_LABELS).map(([value, label]) => ({
  value: Number(value),
  label
}));

export class HvacClient {
  constructor(options) {
    this.host = options.host;
    this.port = options.port || 80;
    this.username = options.username || "admin";
    this.password = options.password || "";
    this.timeoutMs = options.requestTimeoutMs || 5000;
    this.maxStatusPages = options.maxStatusPages || 64;
  }

  async getInfo() {
    return this.request({ f: 1 });
  }

  async getCapability() {
    return this.request({ f: 24 });
  }

  async readUnits() {
    const units = [];

    for (let page = 0; page < this.maxStatusPages; page += 1) {
      const payload = await this.request({ f: 17, p: page });
      const pageUnits = Array.isArray(payload.unit) ? payload.unit : [];
      if (pageUnits.length === 0) break;
      units.push(...pageUnits.map(normalizeUnit));
    }

    return units;
  }

  async updateUnit(idx, patch) {
    const units = await this.readUnits();
    const current = units.find((unit) => unit.idx === idx);
    if (!current) {
      const err = new Error(`Unit ${idx} was not found`);
      err.statusCode = 404;
      throw err;
    }

    const command = buildControlCommand(current, patch);
    const result = await this.request(command);
    if (result.err !== 0) {
      const err = new Error(`Device rejected command with err=${result.err}`);
      err.statusCode = 502;
      err.deviceResponse = result;
      throw err;
    }

    return { unit: { ...current, ...pickControlPatch(command) }, result };
  }

  request(params) {
    return this.requestWithSocket(params).catch((error) => {
      if (!["EHOSTUNREACH", "ENETUNREACH", "EACCES", "EPERM"].includes(error.code)) {
        throw error;
      }
      return this.requestWithCurl(params);
    });
  }

  requestWithSocket(params) {
    const query = encodeQuery(params);
    const path = `/cgi-bin/api.html?${query}`;
    const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    const request = [
      `GET ${path} HTTP/1.0`,
      `Host: ${this.host}`,
      `Authorization: Basic ${auth}`,
      "Connection: close",
      "",
      ""
    ].join("\r\n");

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const chunks = [];
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(this.timeoutMs, () => {
        const err = new Error(`HVAC gateway request timed out after ${this.timeoutMs}ms`);
        err.statusCode = 504;
        fail(err);
      });

      socket.on("connect", () => socket.write(request));
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.on("error", fail);
      socket.on("end", () => {
        if (settled) return;
        settled = true;
        try {
          resolve(parseDeviceJson(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async requestWithCurl(params) {
    const query = encodeQuery(params);
    const url = `http://${this.host}:${this.port}/cgi-bin/api.html?${query}`;
    const { stdout } = await execFileAsync(
      "curl",
      [
        "--silent",
        "--show-error",
        "--http0.9",
        "--max-time",
        String(Math.ceil(this.timeoutMs / 1000)),
        "-u",
        `${this.username}:${this.password}`,
        url
      ],
      { maxBuffer: 1024 * 1024 }
    );

    return parseDeviceJson(stdout);
  }
}

export function normalizeUnit(unit) {
  const normalized = {
    idx: Number(unit.idx),
    oa: Number(unit.oa),
    ia: Number(unit.ia),
    name: unit.nm || `内机 ${unit.idx}`,
    on: Number(unit.on),
    mode: Number(unit.mode),
    modeLabel: MODE_LABELS[Number(unit.mode)] || `模式 ${unit.mode}`,
    alarm: Number(unit.alarm || 0),
    tempSet: Number(unit.tempSet),
    tempIn: Number(unit.tempIn),
    fan: Number(unit.fan),
    fanLabel: FAN_LABELS[Number(unit.fan)] || `风速 ${unit.fan}`,
    group: Number(unit.grp || 0),
    OnoffLock: Number(unit.OnoffLock || 0),
    tempLock: Number(unit.tempLock || 0),
    highestVal: Number(unit.highestVal || 32),
    lowestVal: Number(unit.lowestVal || 16),
    modeLock: Number(unit.modeLock || 0),
    FlowDirection1: Number(unit.FlowDirection1 || 0),
    FlowDirection2: Number(unit.FlowDirection2 || 0),
    MainRmc: Number(unit.MainRmc || 0)
  };

  normalized.address = `${normalized.oa}-${normalized.ia}`;
  return normalized;
}

export function buildControlCommand(current, patch) {
  const command = {
    f: 18,
    on: current.on,
    mode: current.mode,
    tempSet: current.tempSet,
    fan: current.fan,
    FlowDirection1: current.FlowDirection1,
    FlowDirection2: current.FlowDirection2,
    idx: current.idx
  };

  for (const key of ["on", "mode", "tempSet", "fan", "FlowDirection1", "FlowDirection2"]) {
    if (Object.hasOwn(patch, key)) command[key] = Number(patch[key]);
  }

  validateControlCommand(command);
  return command;
}

function validateControlCommand(command) {
  if (![0, 1].includes(command.on)) throw badRequest("on must be 0 or 1");
  if (!Object.hasOwn(MODE_LABELS, command.mode)) throw badRequest("mode is not supported");
  if (!Object.hasOwn(FAN_LABELS, command.fan)) throw badRequest("fan is not supported");
  if (!Number.isInteger(command.tempSet) || command.tempSet < 16 || command.tempSet > 32) {
    throw badRequest("tempSet must be an integer from 16 to 32");
  }
  if (!Number.isInteger(command.FlowDirection1) || command.FlowDirection1 < 0 || command.FlowDirection1 > 7) {
    throw badRequest("FlowDirection1 must be an integer from 0 to 7");
  }
  if (!Number.isInteger(command.FlowDirection2) || command.FlowDirection2 < 0 || command.FlowDirection2 > 6) {
    throw badRequest("FlowDirection2 must be an integer from 0 to 6");
  }
}

function pickControlPatch(command) {
  return {
    on: command.on,
    mode: command.mode,
    modeLabel: MODE_LABELS[command.mode] || `模式 ${command.mode}`,
    tempSet: command.tempSet,
    fan: command.fan,
    fanLabel: FAN_LABELS[command.fan] || `风速 ${command.fan}`,
    FlowDirection1: command.FlowDirection1,
    FlowDirection2: command.FlowDirection2
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function encodeQuery(params) {
  const parts = [];

  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }
  }

  return parts.join("&");
}

export function parseDeviceJson(raw) {
  const trimmed = raw.trim();
  const bodyStart = trimmed.indexOf("{");
  if (bodyStart === -1) {
    const err = new Error("Device response did not contain JSON");
    err.statusCode = 502;
    err.rawResponse = raw;
    throw err;
  }

  return JSON.parse(trimmed.slice(bodyStart));
}
