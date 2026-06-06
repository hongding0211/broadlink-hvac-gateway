import test from "node:test";
import assert from "node:assert/strict";
import { buildControlCommand, normalizeUnit, parseDeviceJson } from "../src/hvacClient.js";

const rawUnit = {
  idx: 1,
  oa: 1,
  ia: 1,
  nm: "客厅",
  on: 1,
  mode: 1,
  alarm: 0,
  tempSet: 26,
  tempIn: 25,
  fan: 0,
  grp: 0,
  OnoffLock: 0,
  tempLock: 0,
  highestVal: 32,
  lowestVal: 16,
  modeLock: 0,
  FlowDirection1: 0,
  FlowDirection2: 0,
  MainRmc: 0
};

test("normalizes device units for the UI", () => {
  const unit = normalizeUnit(rawUnit);
  assert.equal(unit.idx, 1);
  assert.equal(unit.name, "客厅");
  assert.equal(unit.address, "1-1");
  assert.equal(unit.modeLabel, "制冷");
  assert.equal(unit.fanLabel, "自动");
});

test("builds a full control command from current state and patch", () => {
  const current = normalizeUnit(rawUnit);
  const command = buildControlCommand(current, { tempSet: 25 });

  assert.deepEqual(command, {
    f: 18,
    on: 1,
    mode: 1,
    tempSet: 25,
    fan: 0,
    FlowDirection1: 0,
    FlowDirection2: 0,
    idx: 1
  });
});

test("rejects invalid temperatures before sending to device", () => {
  const current = normalizeUnit(rawUnit);
  assert.throws(() => buildControlCommand(current, { tempSet: 33 }), /tempSet/);
});

test("parses raw HTTP zero point nine style JSON", () => {
  assert.deepEqual(parseDeviceJson('{"err":0,"unit":[]}'), { err: 0, unit: [] });
});

test("parses JSON even if a gateway returns headers", () => {
  assert.deepEqual(parseDeviceJson('HTTP/1.0 200 OK\r\n\r\n{"err":0}'), { err: 0 });
});
