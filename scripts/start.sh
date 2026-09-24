#!/usr/bin/env sh
set -eu

if [ "$#" -gt 1 ]; then
  printf 'Usage: %s [port]\n' "$0" >&2
  exit 1
fi
ui_port=${1:-${DALI_DEV_UI_PORT:-5173}}
case "$ui_port" in ''|*[!0-9]*) printf 'Port must be an integer from 1024 to 65533.\n' >&2; exit 1 ;; esac
if [ "${#ui_port}" -gt 5 ] || [ "$ui_port" -lt 1024 ] || [ "$ui_port" -gt 65533 ]; then
  printf 'Port must be an integer from 1024 to 65533.\n' >&2
  exit 1
fi
ui_port=$(expr "$ui_port" + 0)
port_suffix=""
if [ "$ui_port" -ne 5173 ]; then port_suffix="-$ui_port"; fi
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_directory="${DALI_DEV_STATE_DIR:-"$project_root/.gsd/local-dev"}${port_suffix}"
pid_file="$runtime_directory/dali-dev.pid"
log_file="$runtime_directory/dali-dev.log"
export DALI_DEV_UI_PORT="$ui_port"
export DALI_DEV_API_PORT="${DALI_DEV_API_PORT:-$((ui_port + 1))}"
export DALI_DEV_OIDC_PORT="${DALI_DEV_OIDC_PORT:-$((ui_port + 2))}"
export DALI_DEV_STATE_DIR="$runtime_directory"

cd "$project_root"
mkdir -p "$runtime_directory"

if [ -f "$pid_file" ]; then
  running_pid=$(cat "$pid_file")
  if case "$running_pid" in ''|*[!0-9]*) false ;; *) kill -0 "$running_pid" 2>/dev/null && ps -p "$running_pid" -o command= 2>/dev/null | grep -Fq 'scripts/dev.mjs' ;; esac; then
    printf 'Dali local development is already running (PID %s).\n' "$running_pid"
    exit 0
  fi
  rm -f "$pid_file"
fi

nohup node scripts/dev.mjs >"$log_file" 2>&1 &
launcher_pid=$!
printf '%s\n' "$launcher_pid" >"$pid_file"

printf 'Starting Dali local development (PID %s).\n' "$launcher_pid"
printf 'Logs: %s\n' "$log_file"
printf 'Open http://127.0.0.1:%s after the ready message appears.\n' "$ui_port"
