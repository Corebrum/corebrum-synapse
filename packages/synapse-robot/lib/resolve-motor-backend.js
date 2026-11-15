/**
 * Motor backend selection for start-motors.js (unit-tested).
 *
 * @typedef {"rpi"|"firmata"|"jetson"} MotorBackend
 */

const VALID = new Set(["rpi", "firmata", "jetson"]);

/**
 * @param {object} opts
 * @param {string|undefined} opts.argvBackend  -b flag value
 * @param {string|undefined} opts.envBackend SYNAPSE_MOTOR_BACKEND
 * @param {string|undefined} opts.localBackend configstore motorBackend
 * @param {string|undefined} opts.compute portal compute field
 * @param {string|undefined} opts.portalMotorBackend portal motorBackend field
 * @param {() => boolean} opts.isJetson
 * @returns {MotorBackend}
 */
export function resolveMotorBackend(opts) {
  const fromArgv = normalizeBackend(opts.argvBackend);
  if (fromArgv) return fromArgv;

  const fromEnv = normalizeBackend(opts.envBackend);
  if (fromEnv) return fromEnv;

  const fromLocal = normalizeBackend(opts.localBackend);
  if (fromLocal) return fromLocal;

  if (opts.compute === "Raspberry Pi") return "rpi";

  const fromPortal = normalizeBackend(opts.portalMotorBackend);
  if (fromPortal) return fromPortal;

  if (opts.isJetson?.()) return "jetson";

  return "firmata";
}

/** @param {MotorBackend} backend */
export function defaultMotorPins(backend) {
  if (backend === "jetson") return "16,18,22,26";
  if (backend === "rpi") return "27,22,17,18";
  return undefined;
}

function normalizeBackend(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const v = value.trim().toLowerCase();
  return VALID.has(v) ? /** @type {MotorBackend} */ (v) : undefined;
}