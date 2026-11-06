#!/usr/bin/env python3
"""Publish sensor_msgs/BatteryState from Linux sysfs power supplies (ACPI / embedded).

Reads the first power supply where /type is \"Battery\". Skips machines with no
battery ( exits immediately — start scripts should detect first).
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import BatteryState


SYSFS_ROOT = Path("/sys/class/power_supply")


def _read_trim(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def _read_int(path: Path) -> Optional[int]:
    raw = _read_trim(path)
    if raw == "":
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _find_battery_supply() -> Optional[Path]:
    if not SYSFS_ROOT.is_dir():
        return None
    for child in sorted(SYSFS_ROOT.iterdir()):
        if not child.is_dir():
            continue
        t = _read_trim(child / "type").lower()
        if t == "battery":
            return child
    return None


def _map_status(sys_status: str) -> int:
    s = sys_status.lower()
    if s == "charging":
        return BatteryState.POWER_SUPPLY_STATUS_CHARGING
    if s == "discharging":
        return BatteryState.POWER_SUPPLY_STATUS_DISCHARGING
    if s == "full":
        return BatteryState.POWER_SUPPLY_STATUS_FULL
    if s == "not charging":
        return BatteryState.POWER_SUPPLY_STATUS_NOT_CHARGING
    return BatteryState.POWER_SUPPLY_STATUS_UNKNOWN


def _to_ah(microamp_hours: Optional[int]) -> float:
    if microamp_hours is None or microamp_hours < 0:
        return float("nan")
    return microamp_hours / 1e6


class LinuxSysfsBatteryNode(Node):
    def __init__(self) -> None:
        super().__init__("linux_sysfs_battery")
        self.declare_parameter("topic", "battery_state")
        self.declare_parameter("frame_id", "")
        self.declare_parameter("publish_rate_hz", 1.0)
        self.declare_parameter("power_supply_path", "")

        topic = self.get_parameter("topic").get_parameter_value().string_value
        if not topic.startswith("/"):
            topic = f"/{topic}"
        frame_id = self.get_parameter("frame_id").get_parameter_value().string_value
        rate = float(self.get_parameter("publish_rate_hz").get_parameter_value().double_value)
        if rate <= 0.0:
            rate = 1.0
        override = self.get_parameter("power_supply_path").get_parameter_value().string_value

        self._frame_id = frame_id
        self._pub = self.create_publisher(BatteryState, topic, 10)
        self._supply = Path(override) if override else _find_battery_supply()
        if self._supply is None or not self._supply.is_dir():
            self.get_logger().error(
                "No Linux battery power supply found under /sys/class/power_supply. Exiting.",
            )
            raise SystemExit(1)
        self.get_logger().info(f'Publishing BatteryState from sysfs "{self._supply.name}" on {topic}')
        period = 1.0 / rate
        self.create_timer(period, self._tick)

    def _tick(self) -> None:
        if self._supply is None:
            return
        base = self._supply
        msg = BatteryState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = self._frame_id

        status_txt = _read_trim(base / "status")
        msg.power_supply_status = _map_status(status_txt) if status_txt else BatteryState.POWER_SUPPLY_STATUS_UNKNOWN

        cap_pct = _read_int(base / "capacity")
        if cap_pct is not None and 0 <= cap_pct <= 100:
            msg.percentage = float(cap_pct) / 100.0
        else:
            msg.percentage = float("nan")

        v_uv = _read_int(base / "voltage_now")
        if v_uv is not None and v_uv > 0:
            msg.voltage = v_uv / 1e6
        else:
            msg.voltage = float("nan")

        i_ua = _read_int(base / "current_now")
        if i_ua is not None:
            msg.current = i_ua / 1e6
        else:
            msg.current = float("nan")

        c_full = _read_int(base / "charge_full")
        c_now = _read_int(base / "charge_now")
        c_design = _read_int(base / "charge_full_design")
        msg.charge = _to_ah(c_now)
        msg.capacity = _to_ah(c_full)
        msg.design_capacity = _to_ah(c_design)

        msg.present = True
        msg.location = base.name
        msg.serial_number = ""

        msg.power_supply_health = BatteryState.POWER_SUPPLY_HEALTH_UNKNOWN
        tech = _read_trim(base / "technology").upper()
        if "LI" in tech or "LION" in tech:
            msg.power_supply_technology = BatteryState.POWER_SUPPLY_TECHNOLOGY_LION
        elif "LIFE" in tech:
            msg.power_supply_technology = BatteryState.POWER_SUPPLY_TECHNOLOGY_LIFE
        elif "NIMH" in tech:
            msg.power_supply_technology = BatteryState.POWER_SUPPLY_TECHNOLOGY_NIMH

        msg.temperature = float("nan")

        self._pub.publish(msg)


def main() -> None:
    rclpy.init()
    try:
        node = LinuxSysfsBatteryNode()
        rclpy.spin(node)
    except SystemExit:
        raise
    except KeyboardInterrupt:
        pass
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
