# Shared battery publisher helpers for start_demo.sh and synapse start battery.
#
# Expects: CAMERA_LOG convention compatible log/pid names:
#   BATTERY_LOG=/tmp/synapse-battery.log
#   BATTERY_PID_FILE=/tmp/synapse-battery.pid
#
# Requires: ROS environment sourced (/opt/ros and synapse overlay when built).

BATTERY_LOG="${BATTERY_LOG:-/tmp/synapse-battery.log}"
BATTERY_PID_FILE="${BATTERY_PID_FILE:-/tmp/synapse-battery.pid}"

has_linux_battery_sysfs() {
  local d
  [[ -d /sys/class/power_supply ]] || return 1
  for d in /sys/class/power_supply/*; do
    [[ -f "$d/type" ]] || continue
    if grep -qi '^Battery$' "$d/type" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

stop_battery_publisher() {
  local pid=""
  if [[ -f "$BATTERY_PID_FILE" ]]; then
    pid="$(cat "$BATTERY_PID_FILE" 2>/dev/null || true)"
  fi
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    kill -9 "$pid" 2>/dev/null || true
  fi
  pkill -f "synapse_bringup.linux_sysfs_battery" 2>/dev/null || true
  pkill -f "linux_sysfs_battery" 2>/dev/null || true
  rm -f "$BATTERY_PID_FILE"
}

# Start ros2 launch synapse_bringup linux_battery.launch.py in background.
# Skips when no battery in sysfs or workspace not built.
start_battery_publisher() {
  if ! command -v ros2 >/dev/null 2>&1; then
    return 0
  fi
  if ! ros2 pkg prefix synapse_bringup &>/dev/null; then
    echo "   Skipping battery publisher — synapse_bringup is not built (cd ros2_ws && colcon build --symlink-install)." >&2
    return 0
  fi
  if ! has_linux_battery_sysfs; then
    echo "   Skipping battery publisher — no Battery power supply in /sys/class/power_supply." >&2
    return 0
  fi

  stop_battery_publisher
  : >"$BATTERY_LOG"
  nohup ros2 launch synapse_bringup linux_battery.launch.py >"$BATTERY_LOG" 2>&1 &
  local launch_pid=$!
  local node_pid=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    node_pid=$(pgrep -f "synapse_bringup.linux_sysfs_battery" | head -n 1 || true)
    [[ -n "$node_pid" ]] && break
    sleep 0.3
  done
  if [[ -n "$node_pid" ]]; then
    echo "$node_pid" >"$BATTERY_PID_FILE"
    echo "   Battery publisher started (node pid $node_pid, launch pid $launch_pid); log $BATTERY_LOG"
  else
    echo "   WARN: battery launch did not produce linux_sysfs_battery (see $BATTERY_LOG)" >&2
  fi
}
