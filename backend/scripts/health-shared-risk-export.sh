#!/bin/sh
set -eu

last="$(cat /tmp/calm-risk-last-success)"
now="$(date +%s)"
interval="${CALM_TRAINING_INTERVAL_SECONDS:-300}"
test "$last" -le "$now"
test "$((now - last))" -lt "$((interval * 2 + 120))"
