"""Launch linux_sysfs_battery for Corebrum Synapse (optional background reporting)."""

from __future__ import annotations

import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _launch_setup(context, *_args, **_kwargs):
    topic = LaunchConfiguration("topic").perform(context)
    rate = LaunchConfiguration("rate").perform(context)
    frame = LaunchConfiguration("frame_id").perform(context)

    try:
        rate_f = float(rate)
    except ValueError:
        rate_f = 1.0

    return [
        Node(
            package="synapse_bringup",
            executable="linux_sysfs_battery",
            name="linux_sysfs_battery",
            output="screen",
            parameters=[
                {
                    "topic": topic,
                    "publish_rate_hz": rate_f,
                    "frame_id": frame,
                }
            ],
        )
    ]


def generate_launch_description():
    default_topic = "battery_state"
    ns = os.environ.get("SYNAPSE_ROBOT_NAMESPACE", "").strip()
    if ns:
        default_topic = f"/{ns}/battery_state"

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "topic",
                default_value=default_topic,
                description="BatteryState topic (absolute, starts with /).",
            ),
            DeclareLaunchArgument(
                "rate",
                default_value="1.0",
                description="Publish rate in Hz.",
            ),
            DeclareLaunchArgument(
                "frame_id",
                default_value="",
                description="tf frame_id for the message header (often empty).",
            ),
            OpaqueFunction(function=_launch_setup),
        ]
    )
