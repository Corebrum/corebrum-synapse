import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { applyInferredProfileIfMissing } from "../util/infer-active-profile.js";
import { profileSyncDecision } from "../util/robot-cloud-config.js";
import type { RobotProfile } from "../util/robot-profile.js";

function legacyConfig(): Record<string, unknown> {
  return {
    robot: {
      namespace: "",
      name: "My Robot",
      cameraTopic: "/camera/camera/color/image_raw",
    },
    teleop: { cmdVelTopic: "/cmd_vel", speedDefault: 0.3 },
  };
}

function profile(features: string[]): RobotProfile {
  return {
    schema: "synapse.profile.v1",
    features,
    bindings: { cmd_vel: "/cmd_vel" },
  };
}

describe("hardware profile", () => {
  it("infers a mobile base and camera when the active robot has no profile", () => {
    const obj = legacyConfig();
    const result = applyInferredProfileIfMissing(obj, { realsense: false });
    assert.equal(result.applied, true);
    assert.equal(result.id, "default");
    assert.deepEqual(result.features, ["base", "camera"]);
    const robots = obj["robots"] as Array<{ profile: RobotProfile }>;
    assert.equal(robots[0]?.profile.bindings["cmd_vel"], "/cmd_vel");
    assert.equal(robots[0]?.profile.bindings["camera.rgb"], "/camera/camera/color/image_raw");
    assert.equal(robots[0]?.profile.bindings["camera.depth"], undefined);
  });

  it("adds depth when RealSense is present", () => {
    const obj = legacyConfig();
    const result = applyInferredProfileIfMissing(obj, { realsense: true });
    assert.ok(result.features.includes("depth"));
    const robots = obj["robots"] as Array<{ profile: RobotProfile }>;
    assert.equal(
      robots[0]?.profile.bindings["camera.depth"],
      "/camera/camera/depth/image_rect_raw",
    );
  });

  it("leaves an existing profile alone", () => {
    const existing = profile(["base"]);
    const obj = {
      robots: [
        {
          id: "default",
          default: true,
          cameraTopic: "/camera/camera/color/image_raw",
          profile: existing,
        },
      ],
    };
    const result = applyInferredProfileIfMissing(obj, { realsense: true });
    assert.equal(result.applied, false);
    assert.equal((obj.robots[0] as { profile: RobotProfile }).profile, existing);
  });

  it("pushes a local profile and pulls only when the robot has none", () => {
    const local = profile(["base", "camera"]);
    const remote = profile(["base"]);
    assert.equal(profileSyncDecision(local, undefined), "push");
    assert.equal(profileSyncDecision(local, remote), "push");
    assert.equal(profileSyncDecision(undefined, remote), "pull");
    assert.equal(profileSyncDecision(local, local), "none");
    assert.equal(profileSyncDecision(undefined, undefined), "none");
  });
});
