import test from "node:test";
import assert from "node:assert/strict";

import { resolveMotorBackend, defaultMotorPins } from "./resolve-motor-backend.js";

const notJetson = () => false;
const jetson = () => true;

test("argv backend wins", () => {
  assert.equal(
    resolveMotorBackend({ argvBackend: "firmata", compute: "Raspberry Pi", isJetson: jetson }),
    "firmata",
  );
});

test("env backend after argv", () => {
  assert.equal(
    resolveMotorBackend({ envBackend: "jetson", compute: "Raspberry Pi", isJetson: notJetson }),
    "jetson",
  );
});

test("local backend before portal compute", () => {
  assert.equal(
    resolveMotorBackend({
      localBackend: "rpi",
      compute: "Nvidia Orin",
      portalMotorBackend: "jetson",
      isJetson: jetson,
    }),
    "rpi",
  );
});

test("raspberry pi compute selects rpi", () => {
  assert.equal(
    resolveMotorBackend({ compute: "Raspberry Pi", isJetson: notJetson }),
    "rpi",
  );
});

test("tegra detect before stale portal firmata", () => {
  assert.equal(
    resolveMotorBackend({
      compute: "Nvidia Orin",
      portalMotorBackend: "firmata",
      isJetson: jetson,
    }),
    "jetson",
  );
});

test("portal motorBackend on non-tegra", () => {
  assert.equal(
    resolveMotorBackend({
      compute: "Intel NUC",
      portalMotorBackend: "firmata",
      isJetson: notJetson,
    }),
    "firmata",
  );
});

test("tegra defaults to jetson", () => {
  assert.equal(resolveMotorBackend({ isJetson: jetson }), "jetson");
});

test("non-tegra defaults to firmata", () => {
  assert.equal(resolveMotorBackend({ isJetson: notJetson }), "firmata");
});

test("default pins per backend", () => {
  assert.equal(defaultMotorPins("jetson"), "16,18,22,26");
  assert.equal(defaultMotorPins("rpi"), "27,22,17,18");
  assert.equal(defaultMotorPins("firmata"), undefined);
});