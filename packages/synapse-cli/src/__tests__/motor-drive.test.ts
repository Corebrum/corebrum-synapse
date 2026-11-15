import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PINS,
  inferMotorBackendFromCompute,
  normalizeBackend,
} from "../util/motor-drive.js";

describe("motor-drive", () => {
  it("infers jetson from Orin compute labels", () => {
    assert.equal(inferMotorBackendFromCompute("Jetson Orin Nano"), "jetson");
    assert.equal(inferMotorBackendFromCompute("Nvidia Thor"), "jetson");
  });

  it("infers rpi from Raspberry Pi", () => {
    assert.equal(inferMotorBackendFromCompute("Raspberry Pi"), "rpi");
  });

  it("defaults firmata for generic hosts", () => {
    assert.equal(inferMotorBackendFromCompute("Radxa"), "firmata");
  });

  it("normalizes backend names", () => {
    assert.equal(normalizeBackend("JETSON"), "jetson");
    assert.equal(normalizeBackend(""), undefined);
  });

  it("ships reference pin map for jetson", () => {
    assert.equal(DEFAULT_PINS.jetson, "16,18,22,26");
  });
});