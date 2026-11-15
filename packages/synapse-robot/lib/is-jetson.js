import { existsSync, readFileSync } from "node:fs";

const tegraRelease = process.env.SYNAPSE_NV_TEGRA_RELEASE ?? "/etc/nv_tegra_release";

function readDeviceTreeModel() {
  const path = process.env.SYNAPSE_DEVICE_TREE_MODEL ?? "/proc/device-tree/model";
  try {
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf8").replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

function readDeviceTreeCompatible() {
  const path = process.env.SYNAPSE_DEVICE_TREE_COMPATIBLE ?? "/proc/device-tree/compatible";
  try {
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** NVIDIA Jetson / Tegra (L4T or device-tree markers). */
export function isJetson() {
  try {
    if (existsSync(tegraRelease)) return true;
  } catch {
    // ignore
  }
  const model = readDeviceTreeModel();
  if (model.includes("Jetson")) return true;
  const compatible = readDeviceTreeCompatible();
  return compatible.includes("nvidia,tegra");
}