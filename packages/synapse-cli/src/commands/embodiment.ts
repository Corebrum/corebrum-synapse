/**
 * `synapse embodiment` — local compute + GPIO / Firmata motor setup.
 *
 * Saves configstore motorBackend, motorPins, and compute. Used by start-motors.js
 * and synapse up real. Optionally PATCHes Corebrum Cloud when signed in.
 */

import { confirm, input, select } from "@inquirer/prompts";

import {
  COMPUTE_CHOICES,
  DEFAULT_PINS,
  MOTOR_BACKENDS,
  type MotorBackend,
  inferMotorBackendFromCompute,
  readLocalEmbodimentPrefs,
  setLocalEmbodimentPrefs,
  suggestDefaults,
} from "../util/motor-drive.js";
import {
  fetchRobotDetails,
  getApiToken,
  getRobotId,
  isCloudRobotRegistered,
  patchCloudRobotEmbodiment,
} from "../util/robot-cloud-config.js";
import { dim, err, header, info, ok, warn } from "../util/logger.js";

export interface EmbodimentOptions {
  /** setup | show */
  action?: string;
  backend?: string;
  pins?: string;
  compute?: string;
  device?: string;
  /** true = PATCH Cloud; false = skip; undefined = ask when signed in. */
  syncCloud?: boolean;
  yes?: boolean;
}

const BACKEND_LABELS: Record<MotorBackend, string> = {
  jetson: "Jetson native GPIO (JETGPIO)",
  rpi: "Raspberry Pi GPIO",
  firmata: "Arduino Firmata (USB serial)",
};

export async function embodimentCommand(opts: EmbodimentOptions = {}): Promise<void> {
  const action = (opts.action ?? "setup").toLowerCase();
  if (action === "show") {
    await showEmbodiment();
    return;
  }
  if (action !== "setup") {
    err("Usage: synapse embodiment [setup|show]");
    process.exit(2);
  }
  await setupEmbodiment(opts);
}

async function showEmbodiment(): Promise<void> {
  header("Robot drive setup");
  const local = readLocalEmbodimentPrefs();
  const cloud = await fetchRobotDetails();

  info("Local (configstore — used by synapse start motors and synapse up real):");
  dim(`  compute:       ${local.compute ?? "(not set — auto-detect on Tegra only)"}`);
  dim(`  motorBackend:  ${local.motorBackend ?? "(not set)"}`);
  dim(`  motorPins:     ${local.motorPins ?? "(backend defaults)"}`);

  if (getApiToken() && getRobotId()) {
    info("Corebrum Cloud (when registered):");
    dim(`  compute:       ${cloud.compute ?? "(not on record)"}`);
    dim(`  motorBackend:  ${cloud.motorBackend ?? "(not on record)"}`);
  } else {
    warn("Not signed in to Corebrum Cloud — only local prefs apply.");
    dim("  Cloud: Set up / synapse login + synapse register to sync remote start_motors.");
  }
}

async function setupEmbodiment(opts: EmbodimentOptions): Promise<void> {
  header("Robot drive setup");
  info(
    "Pick compute and motor GPIO. Saved locally for synapse start motors and synapse up real.",
  );
  dim("Overrides: synapse start motors -b … or SYNAPSE_MOTOR_BACKEND.");

  const existing = readLocalEmbodimentPrefs();
  const suggested = suggestDefaults();

  let compute =
    opts.compute?.trim() ||
    existing.compute ||
    (opts.yes ? suggested.compute : undefined);

  if (!compute) {
    compute = await select({
      message: "Compute on this robot",
      choices: [...COMPUTE_CHOICES],
      default: suggested.compute,
    });
  }

  let backend: MotorBackend =
    (opts.backend && MOTOR_BACKENDS.includes(opts.backend as MotorBackend)
      ? (opts.backend as MotorBackend)
      : undefined) ||
    existing.motorBackend ||
    inferMotorBackendFromCompute(compute);

  if (!opts.backend && !opts.yes) {
    backend = await select({
      message: "Motor backend",
      choices: MOTOR_BACKENDS.map((b) => ({
        name: BACKEND_LABELS[b],
        value: b,
      })),
      default: backend,
    });
  }

  let pins =
    opts.pins?.trim() ||
    existing.motorPins ||
    DEFAULT_PINS[backend] ||
    "";

  if (backend !== "firmata" && !opts.pins && !opts.yes) {
    const raw = await input({
      message: "Motor GPIO pins (comma-separated)",
      default: pins || DEFAULT_PINS[backend] || "",
      validate: (v) => (v.trim() ? true : "Pin list is required for GPIO backends"),
    });
    pins = raw.trim();
  }

  let firmataDevice = opts.device?.trim();
  if (backend === "firmata" && !opts.yes && !firmataDevice) {
    const dev = await input({
      message: "Firmata serial device (empty = auto /dev/ttyACM0)",
      default: "",
    });
    firmataDevice = dev.trim() || undefined;
  }

  const save: Parameters<typeof setLocalEmbodimentPrefs>[0] = {
    compute,
    motorBackend: backend,
    motorPins: pins || undefined,
  };
  if (backend === "firmata" && firmataDevice) {
    save.firmataDevice = firmataDevice;
  }
  setLocalEmbodimentPrefs(save);

  ok("Saved local drive setup.");
  dim(`  compute=${compute}  backend=${backend}  pins=${pins || "(default)"}`);

  const canSync = Boolean(getApiToken());
  let doSync: boolean;
  if (opts.syncCloud === true) {
    doSync = true;
  } else if (opts.syncCloud === false) {
    doSync = false;
  } else if (!canSync || opts.yes) {
    doSync = false;
  } else {
    doSync = await confirm({
      message: "Update this robot on Corebrum Cloud (compute + motor backend)?",
      default: await isCloudRobotRegistered(),
    });
  }

  if (doSync) {
    if (!getApiToken()) {
      warn("No API token — run synapse login, then embodiment setup again.");
      return;
    }
    try {
      await patchCloudRobotEmbodiment({
        compute,
        motorBackend: backend,
      });
      ok("Corebrum Cloud robot record updated.");
    } catch (e) {
      warn(e instanceof Error ? e.message : String(e));
      dim("Register with synapse register if this robot is not on your account yet.");
    }
  } else if (!canSync) {
    dim("Local-only mode: synapse login + synapse register when you want Cloud teleop.");
  }
}