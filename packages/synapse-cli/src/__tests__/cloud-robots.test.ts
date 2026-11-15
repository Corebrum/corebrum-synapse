import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMyRobotsPayload } from "../util/robot-cloud-config.js";

describe("parseMyRobotsPayload", () => {
  it("accepts legacy string ids", () => {
    const rows = parseMyRobotsPayload(["abc", "def"]);
    assert.deepEqual(rows.map((r) => r.id), ["abc", "def"]);
  });

  it("parses full robot rows from /myrobots", () => {
    const rows = parseMyRobotsPayload([
      {
        id: "r1",
        name: "Lab bot",
        compute: "Jetson Orin Nano",
        motorBackend: "jetson",
        online: true,
      },
    ]);
    assert.equal(rows[0]?.id, "r1");
    assert.equal(rows[0]?.name, "Lab bot");
    assert.equal(rows[0]?.motorBackend, "jetson");
    assert.equal(rows[0]?.online, true);
  });
});