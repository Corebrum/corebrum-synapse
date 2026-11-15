# Jetson reference embodiment — Tier B-ref acceptance

Reference kit: Jetson Orin (Tegra) + L298N + RealSense, BOARD pins `16,18,22,26`, no Arduino.

## Prerequisites

- Corebrum OS or Ubuntu with ROS 2 + Zenoh + RealSense + Corebrum Synapse installed
- [JETGPIO](https://github.com/Rubberazer/JETGPIO) installed (`libjetgpio.so`)
- `synapse init` and `pnpm install` in the Synapse checkout (koffi optionalDependency)
- Corebrum Cloud robot registered with wheel diameter **64** mm and track **135** mm (defaults)
- Compute **Jetson Orin Nano** and `motorBackend` **jetson** on the portal (optional)

## Checks

1. `synapse doctor` — JETGPIO green, koffi green or yellow with hint.
2. `synapse start motors` on Tegra **without** `-b` — log shows `motors-jetson.js`.
3. `synapse status` — motors process alive; `/tmp/synapse-motors.log` has no immediate crash.
4. Publish a small forward twist on `/cmd_vel` (bounded, clear space) — wheels respond.
5. `synapse stop motors` or agent `ros2_estop` — motion stops.

## Not in scope for B-ref

- RTAB-Map / Nav2 (Tier D-ref)
- Cloud joystick teleop (Tier C-ref)
- Encoder odom (Firmata-only)

Record pass/fail date and hardware serial in `corebrum-os` decision 0136 when complete.