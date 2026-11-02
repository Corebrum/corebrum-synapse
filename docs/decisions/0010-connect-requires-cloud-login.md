# 0010. connect requires Cloud login and a stable signaling session

Date: 2026-11-02
Status: Accepted

## Context

Operators sometimes opened cloud.corebrum.com in a browser and ran `synapse connect` without `synapse login` / `synapse register` on the robot. `comms.js` stayed alive while the signaling server disconnected it in a loop, so the CLI printed "Robot connected" and the dashboard never showed presence. A missing `node-datachannel` native binary also crashed connect after Synapse rebuilds that skipped optional install scripts.

## Decision

- `synapse connect` requires a Corebrum Cloud API token and a robot id registered to that account. In a TTY it offers login / register; otherwise it exits with those commands.
- Before spawn, load `node-datachannel` from the robot package and fail with a rebuild hint when the native module is missing.
- After spawn, wait until the log shows a signaling connect that stays up for a short quiet window. Any `io server disconnect` / disconnect line fails the command and stops `comms.js`.

## Consequences

Local-only robots still skip Cloud during `synapse init`. Presence needs an explicit connect path that cannot report success while offline.
