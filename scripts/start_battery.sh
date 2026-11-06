#!/bin/bash
# Standalone battery publisher start (used by `synapse start battery`).
# Publishes sensor_msgs/BatteryState when Linux exposes a Battery in sysfs.

set -e

ROS_DISTRO="${1:-jazzy}"

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BATTERY_LOG=/tmp/synapse-battery.log
BATTERY_PID_FILE=/tmp/synapse-battery.pid

# shellcheck source=lib/battery.sh
source "$REPO_ROOT/scripts/lib/battery.sh"

if [[ -f "/opt/ros/$ROS_DISTRO/setup.bash" ]]; then
  # shellcheck disable=SC1090
  source "/opt/ros/$ROS_DISTRO/setup.bash"
fi
if [[ -f "$REPO_ROOT/ros2_ws/install/setup.bash" ]]; then
  # shellcheck disable=SC1090
  source "$REPO_ROOT/ros2_ws/install/setup.bash"
fi

start_battery_publisher
