/**
 * Local motor drive / compute preferences (configstore + Cloud alignment).
 */

import Configstore from "configstore";

import { isJetson } from "./env.js";

const primary = new Configstore("synapse");

export const MOTOR_BACKENDS = ["jetson", "rpi", "firmata"] as const;
export type MotorBackend = (typeof MOTOR_BACKENDS)[number];

export const COMPUTE_CHOICES = [
  { name: "Jetson Orin Nano (reference)", value: "Jetson Orin Nano" },
  { name: "Nvidia Orin", value: "Nvidia Orin" },
  { name: "Nvidia Orin NX", value: "Nvidia Orin NX" },
  { name: "Nvidia Thor", value: "Nvidia Thor" },
  { name: "Raspberry Pi", value: "Raspberry Pi" },
  { name: "Radxa", value: "Radxa" },
  { name: "Latte Panda", value: "Latte Panda" },
  { name: "Arduino + host PC", value: "Arduino" },
] as const;

export const DEFAULT_PINS: Record<MotorBackend, string | undefined> = {
  jetson: "16,18,22,26",
  rpi: "27,22,17,18",
  firmata: undefined,
};

export interface LocalEmbodimentPrefs {
  motorBackend?: MotorBackend;
  motorPins?: string;
  compute?: string;
  firmataDevice?: string;
}

export function readLocalEmbodimentPrefs(): LocalEmbodimentPrefs {
  const motorBackend = normalizeBackend(primary.get("motorBackend"));
  const pins = primary.get("motorPins");
  const compute = primary.get("compute");
  const device = primary.get("firmataDevice");
  return {
    motorBackend,
    motorPins:
      typeof pins === "string" && pins.trim() ? pins.trim() : undefined,
    compute:
      typeof compute === "string" && compute.trim() ? compute.trim() : undefined,
    firmataDevice:
      typeof device === "string" && device.trim() ? device.trim() : undefined,
  };
}

export function setLocalEmbodimentPrefs(prefs: LocalEmbodimentPrefs): void {
  if (prefs.motorBackend) {
    primary.set("motorBackend", prefs.motorBackend);
  } else {
    primary.delete("motorBackend");
  }
  if (prefs.motorPins?.trim()) {
    primary.set("motorPins", prefs.motorPins.trim());
  } else {
    primary.delete("motorPins");
  }
  if (prefs.compute?.trim()) {
    primary.set("compute", prefs.compute.trim());
  } else {
    primary.delete("compute");
  }
  if (prefs.firmataDevice?.trim()) {
    primary.set("firmataDevice", prefs.firmataDevice.trim());
  } else if (prefs.firmataDevice === "") {
    primary.delete("firmataDevice");
  }
}

export function inferMotorBackendFromCompute(compute: string): MotorBackend {
  const c = compute.trim();
  if (/orin|thor|jetson/i.test(c)) return "jetson";
  if (c === "Raspberry Pi") return "rpi";
  return "firmata";
}

export function suggestDefaults(): {
  compute: string;
  motorBackend: MotorBackend;
  motorPins: string | undefined;
} {
  if (isJetson()) {
    return {
      compute: "Jetson Orin Nano",
      motorBackend: "jetson",
      motorPins: DEFAULT_PINS.jetson,
    };
  }
  return {
    compute: "Raspberry Pi",
    motorBackend: "rpi",
    motorPins: DEFAULT_PINS.rpi,
  };
}

export function normalizeBackend(value: unknown): MotorBackend | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const v = value.trim().toLowerCase() as MotorBackend;
  return (MOTOR_BACKENDS as readonly string[]).includes(v) ? v : undefined;
}

/** Apply Cloud robot fields to local embodiment prefs (additive). */
export function pullEmbodimentFromCloud(record: {
  compute?: string;
  motorBackend?: string;
}): void {
  const current = readLocalEmbodimentPrefs();
  const next: LocalEmbodimentPrefs = { ...current };
  if (record.compute?.trim()) next.compute = record.compute.trim();
  let backend = normalizeBackend(record.motorBackend);
  if (backend === "firmata" && isJetson()) {
    backend = "jetson";
  }
  if (backend) next.motorBackend = backend;
  if (
    next.compute !== current.compute ||
    next.motorBackend !== current.motorBackend
  ) {
    setLocalEmbodimentPrefs(next);
  }
}