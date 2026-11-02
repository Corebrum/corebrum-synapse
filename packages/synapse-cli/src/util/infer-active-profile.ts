/**
 * Fill synapse.profile.v1 on the active robot when init has not written one.
 * RealSense detection adds camera + depth. A mobile kind (the default) adds base.
 */

import { execFileSync } from "node:child_process";

import {
  getActiveRobotId,
  readConfigObject,
  readRobots,
  setProfileForRobot,
  writeConfigObject,
  type RobotEntry,
} from "./robot-config.js";
import { inferProfileDraft, type RobotProfile } from "./robot-profile.js";

export function realsensePresent(): boolean {
  const forced = process.env["SYNAPSE_HAS_REALSENSE"];
  if (forced === "1") return true;
  if (forced === "0") return false;
  try {
    const out = execFileSync("lsusb", { encoding: "utf8", timeout: 2000 });
    return /realsense|8086:0b07|8086:0b3a|8086:0b5b|8086:0b5c|8086:0b64/i.test(out);
  } catch {
    return false;
  }
}

function cmdVelFrom(obj: Record<string, unknown>): string | undefined {
  const teleop = obj["teleop"];
  if (!teleop || typeof teleop !== "object" || Array.isArray(teleop)) return undefined;
  const topic = (teleop as Record<string, unknown>)["cmdVelTopic"];
  return typeof topic === "string" && topic.trim() ? topic.trim() : undefined;
}

export function applyInferredProfileIfMissing(
  obj: Record<string, unknown>,
  opts: { realsense?: boolean } = {},
): { applied: boolean; id?: string; features: string[] } {
  const { robots } = readRobots(obj);
  const activeId = getActiveRobotId(obj);
  const entry: RobotEntry | undefined = robots.find((r) => r.id === activeId) ?? robots[0];
  if (!entry || entry.profile) return { applied: false, features: [] };

  const sensors = { ...(entry.sensors ?? {}) };
  if (opts.realsense === true && sensors.has_realsense === undefined) {
    sensors.has_realsense = true;
  }
  const draft = inferProfileDraft({
    namespace: entry.namespace,
    cameraTopic: entry.cameraTopic,
    kind: entry.kind,
    sensors,
    cmdVelTopic: cmdVelFrom(obj),
  });
  setProfileForRobot(entry.id, draft, obj);
  return { applied: true, id: entry.id, features: draft.features };
}

/** Read config, infer when the active robot has no profile, and write it back. */
export function ensureHardwareProfile(opts: { realsense?: boolean } = {}): {
  applied: boolean;
  features: string[];
} {
  const obj = readConfigObject();
  const result = applyInferredProfileIfMissing(obj, opts);
  if (result.applied) writeConfigObject(obj);
  return { applied: result.applied, features: result.features };
}

export type { RobotProfile };
