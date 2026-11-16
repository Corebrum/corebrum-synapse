# Jetson reference embodiment — Tier C-ref acceptance

**Prerequisite:** B-ref passed (native Jetson GPIO motors). See [jetson-b-ref.md](./jetson-b-ref.md).

## Checks

1. `synapse login` and `synapse cloud setup` (or register + connect) on the robot.
2. Robot shows online on [Corebrum Cloud](https://cloud.corebrum.com).
3. Operator drives from Cloud teleop with live feedback; motion stops when teleop released.
4. Optional: remote **Start motors** from the portal uses per-robot `motorBackend` (Jetson preset).

## Not in scope for C-ref

- RTAB-Map / Nav2 (Tier D-ref)

## Record

| Date | Result | Notes |
|------|--------|-------|
| 2026-11-16 | Pass | Operator demo: Cloud teleop on Jetson GPIO reference kit (see ADR 0136 in corebrum-os). |