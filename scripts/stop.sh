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

if [ ! -f "$pid_file" ]; then
  printf 'Dali local development is not running.\n'
  exit 0
fi

launcher_pid=$(cat "$pid_file")
if ! case "$launcher_pid" in ''|*[!0-9]*) false ;; *) kill -0 "$launcher_pid" 2>/dev/null && ps -p "$launcher_pid" -o command= 2>/dev/null | grep -Fq 'scripts/dev.mjs' ;; esac; then
  rm -f "$pid_file"
  printf 'Removed stale Dali local development PID file.\n'
  exit 0
fi

kill -TERM "$launcher_pid"

attempt=0
while kill -0 "$launcher_pid" 2>/dev/null && [ "$attempt" -lt 20 ]; do
  attempt=$((attempt + 1))
  sleep 1
done

if kill -0 "$launcher_pid" 2>/dev/null; then
  printf 'Dali local development is still stopping; check %s/dali-dev.log.\n' "$runtime_directory" >&2
  exit 1
fi

rm -f "$pid_file"
printf 'Dali local development stopped.\n'
