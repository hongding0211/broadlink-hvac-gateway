import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AliasStore } from "../src/backend/aliasStore.js";
import { buildControlCommand, normalizeUnit, parseDeviceJson } from "../src/backend/hvacClient.js";

const rawUnit = {
  idx: 1,
  oa: 1,
  ia: 1,
  nm: "Living Room",
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
  assert.equal(unit.name, "Living Room");
  assert.equal(unit.address, "1-1");
  assert.equal(unit.modeLabel, "Cooling");
  assert.equal(unit.fanLabel, "Auto");
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

test("defaults fan to auto when powering on an off unit without explicit fan", () => {
  const current = normalizeUnit({ ...rawUnit, on: 0, fan: 1 });
  const command = buildControlCommand(current, { on: 1 });

  assert.equal(command.on, 1);
  assert.equal(command.fan, 0);
});

test("preserves explicit fan when powering on an off unit", () => {
  const current = normalizeUnit({ ...rawUnit, on: 0, fan: 1 });
  const command = buildControlCommand(current, { on: 1, fan: 2 });

  assert.equal(command.on, 1);
  assert.equal(command.fan, 2);
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

test("stores and applies local unit aliases", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hvac-alias-"));
  try {
    const store = new AliasStore(dir);
    await store.set(1, "Primary Bedroom");

    const units = await store.apply([normalizeUnit(rawUnit)]);
    assert.equal(units[0].alias, "Primary Bedroom");
    assert.equal(units[0].name, "Primary Bedroom");

    await store.set(1, "");
    const cleared = await store.apply([normalizeUnit(rawUnit)]);
    assert.equal(cleared[0].alias, "");
    assert.equal(cleared[0].name, "Living Room");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
