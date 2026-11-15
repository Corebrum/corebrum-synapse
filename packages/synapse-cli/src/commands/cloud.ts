/**
 * `synapse cloud setup` / `synapse cloud link` — operator onboarding.
 */

import { confirm, select } from "@inquirer/prompts";

import { loginCommand } from "./cloud-auth.js";
import { whoamiCommand } from "./cloud-auth.js";
import { registerCommand } from "./register.js";
import { embodimentCommand } from "./embodiment.js";
import { connectCommand } from "./robot-hw.js";
import {
  getApiToken,
  getRobotId,
  isCloudRobotRegistered,
  listAccessibleCloudRobots,
  setRobotId,
  type CloudRobotSummary,
} from "../util/robot-cloud-config.js";
import {
  pullEmbodimentFromCloud,
  readLocalEmbodimentPrefs,
} from "../util/motor-drive.js";
import { dim, err, header, info, ok, warn } from "../util/logger.js";

export interface CloudSetupOptions {
  /** Skip embodiment wizard step. */
  skipEmbodiment?: boolean;
  /** Skip synapse connect. */
  skipConnect?: boolean;
  /** Force register (skip link prompt). */
  register?: boolean;
  /** Link to this Cloud robot id (non-interactive). */
  linkId?: string;
  yes?: boolean;
}

export interface CloudLinkOptions {
  robotId?: string;
  yes?: boolean;
  /** Do not copy compute / motorBackend from Cloud to local configstore. */
  noPull?: boolean;
}

export async function cloudSetupCommand(opts: CloudSetupOptions = {}): Promise<void> {
  header("Corebrum Cloud setup");
  info(
    "Sign in on this robot, claim or link a robot id, optionally set motor drive, then connect.",
  );
  dim("Browser sign-in on cloud.corebrum.com alone does not store an API token here.");

  if (!opts.skipEmbodiment) {
    const local = readLocalEmbodimentPrefs();
    const needEmbodiment = !local.motorBackend || !local.compute;
    if (needEmbodiment) {
      if (
        opts.yes ||
        (await confirm({
          message: "Configure motor drive (compute + GPIO) first?",
          default: true,
        }))
      ) {
        await embodimentCommand({
          action: "setup",
          yes: opts.yes,
          syncCloud: false,
        });
      }
    } else {
      dim("Motor drive already configured (synapse embodiment show).");
    }
  }

  if (!getApiToken()) {
    info("=== Sign in ===");
    if (opts.yes) {
      err("Not logged in. Run synapse login or omit --yes.");
      process.exit(1);
    }
    await loginCommand({});
    if (!getApiToken()) {
      err("Sign-in did not store an API token.");
      process.exit(1);
    }
  } else {
    ok("Already signed in.");
  }

  const registered = await isCloudRobotRegistered();
  if (registered) {
    ok("This machine's ROBOT ID is already registered on your account.");
  } else if (opts.linkId) {
    await cloudLinkCommand({ robotId: opts.linkId, yes: true });
  } else if (opts.register) {
    info("=== Register this robot ===");
    await registerCommand({ yes: opts.yes, defaults: opts.yes });
  } else if (!opts.yes) {
    const path = await select({
      message: "This robot is not registered on your account yet",
      choices: [
        {
          name: "Register this machine (minted ROBOT ID → your account)",
          value: "register",
        },
        {
          name: "Link to an existing Cloud robot (pick from account list)",
          value: "link",
        },
        { name: "Skip for now (local only)", value: "skip" },
      ],
      default: "register",
    });
    if (path === "register") {
      info("=== Register this robot ===");
      await registerCommand({});
    } else if (path === "link") {
      await cloudLinkCommand({});
    } else {
      warn("Skipped Cloud registration — teleop and remote CLI will not work.");
    }
  } else {
    info("=== Register this robot ===");
    await registerCommand({ yes: true, defaults: true });
  }

  if (!opts.skipConnect) {
    const stillRegistered = await isCloudRobotRegistered();
    if (stillRegistered || getRobotId()) {
      info("=== Connect ===");
      await connectCommand({});
    } else {
      warn("Skipped connect — no registered ROBOT ID.");
    }
  }

  info("=== Account status ===");
  await whoamiCommand();
  dim("Run synapse doctor for cloud and JETGPIO checks.");
}

export async function cloudLinkCommand(opts: CloudLinkOptions = {}): Promise<void> {
  header("Link this machine to a Cloud robot");

  if (!getApiToken()) {
    err("Not logged in. Run `synapse login` first.");
    process.exit(1);
  }

  let robots: CloudRobotSummary[];
  try {
    robots = await listAccessibleCloudRobots();
  } catch (e) {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (robots.length === 0) {
    warn("No robots on your account. Run `synapse register` to create one.");
    process.exit(1);
  }

  let chosen: CloudRobotSummary;
  const explicit = opts.robotId?.trim();
  if (explicit) {
    const match = robots.find((r) => r.id === explicit);
    if (!match) {
      err(`Robot ${explicit} is not on your account.`);
      process.exit(1);
    }
    chosen = match;
  } else if (robots.length === 1) {
    chosen = robots[0]!;
    ok(`Only one Cloud robot: ${formatRobotRow(chosen)}`);
  } else {
    const localId = getRobotId();
    chosen = await select({
      message: "Which Cloud robot is this physical machine?",
      choices: robots.map((r) => ({
        name: formatRobotRow(r) + (r.id === localId ? " (current local id)" : ""),
        value: r,
      })),
    });
  }

  if (
    !opts.yes &&
    getRobotId() &&
    getRobotId() !== chosen.id &&
    !(await confirm({
      message: `Replace local ROBOT ID with ${chosen.id}?`,
      default: true,
    }))
  ) {
    info("Link cancelled.");
    return;
  }

  setRobotId(chosen.id);
  ok(`Local ROBOT ID set to ${chosen.id}.`);

  if (!opts.noPull) {
    pullEmbodimentFromCloud(chosen);
    if (chosen.compute || chosen.motorBackend) {
      ok("Copied compute and motor backend from Cloud to local embodiment prefs.");
    }
  }

  const registered = await isCloudRobotRegistered();
  if (registered) {
    ok("This machine is linked to your Corebrum Cloud account.");
  } else {
    warn("Could not verify registration — check synapse whoami.");
  }
}

function formatRobotRow(r: CloudRobotSummary): string {
  const name = r.name?.trim() || "(unnamed)";
  const compute = r.compute ? ` · ${r.compute}` : "";
  const backend = r.motorBackend ? ` · ${r.motorBackend}` : "";
  const online =
    r.online === true ? " · online" : r.online === false ? " · offline" : "";
  return `${name} [${r.id}]${compute}${backend}${online}`;
}
