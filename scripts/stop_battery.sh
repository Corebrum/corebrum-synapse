#!/bin/bash
# Standalone battery publisher stop (used by `synapse stop battery`).

set -e

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BATTERY_LOG=/tmp/synapse-battery.log
BATTERY_PID_FILE=/tmp/synapse-battery.pid

# shellcheck source=lib/battery.sh
source "$REPO_ROOT/scripts/lib/battery.sh"

stop_battery_publisher
echo "Battery publisher stopped."
