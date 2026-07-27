#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://localhost}"
KIOSK_MODE="${KIOSK_MODE:-dual}"
MAIN_GEOMETRY="${MAIN_GEOMETRY:-1920x1080+0+0}"
DASHBOARD_GEOMETRY="${DASHBOARD_GEOMETRY:-3840x2160+1920+0}"
CHROMIUM_BIN="${CHROMIUM_BIN:-}"
CHROMIUM_FLAGS="${CHROMIUM_FLAGS:-}"
ENABLE_GPU_TUNING="${ENABLE_GPU_TUNING:-0}"
ENABLE_FCITX="${ENABLE_FCITX:-1}"
MAIN_PROFILE_DIR="${MAIN_PROFILE_DIR:-$HOME/.config/mccb-kiosk/main}"
DASHBOARD_PROFILE_DIR="${DASHBOARD_PROFILE_DIR:-$HOME/.config/mccb-kiosk/dashboard}"
MAIN_SCALE="${MAIN_SCALE:-1}"
DASHBOARD_SCALE="${DASHBOARD_SCALE:-1.5}"
DISPLAY_WAIT_SECONDS="${DISPLAY_WAIT_SECONDS:-60}"
XCURSOR_SIZE="${XCURSOR_SIZE:-24}"
DISPLAY_SLEEP_MODE="${DISPLAY_SLEEP_MODE:-off}"
IDLE_SLEEP_MINUTES="${IDLE_SLEEP_MINUTES:-15}"
SLEEP_START_TIME="${SLEEP_START_TIME:-}"
SLEEP_END_TIME="${SLEEP_END_TIME:-}"
SLEEP_CHECK_INTERVAL_SECONDS="${SLEEP_CHECK_INTERVAL_SECONDS:-60}"

export XCURSOR_SIZE

case "$DISPLAY_SLEEP_MODE" in
  off|idle|schedule|both)
    ;;
  *)
    echo "Invalid DISPLAY_SLEEP_MODE: $DISPLAY_SLEEP_MODE. Use 'off', 'idle', 'schedule', or 'both'." >&2
    exit 1
    ;;
esac

if [ "$DISPLAY_SLEEP_MODE" = "schedule" ] || [ "$DISPLAY_SLEEP_MODE" = "both" ]; then
  if [ -z "$SLEEP_START_TIME" ] || [ -z "$SLEEP_END_TIME" ]; then
    echo "SLEEP_START_TIME and SLEEP_END_TIME (HH:MM) are required for DISPLAY_SLEEP_MODE=$DISPLAY_SLEEP_MODE." >&2
    exit 1
  fi
fi

if [ -z "$CHROMIUM_BIN" ]; then
  if [ -x /usr/lib/chromium/chromium ]; then
    CHROMIUM_BIN="/usr/lib/chromium/chromium"
  elif command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_BIN="chromium-browser"
  elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM_BIN="chromium"
  else
    echo "Chromium executable was not found. Install chromium-browser or chromium." >&2
    exit 1
  fi
fi

parse_geometry() {
  local geometry="$1"
  local size="${geometry%%+*}"
  local position="${geometry#*+}"
  local x="${position%%+*}"
  local y="${position#*+}"

  printf '%s %s,%s\n' "$size" "$x" "$y"
}

read -r MAIN_SIZE MAIN_POSITION < <(parse_geometry "$MAIN_GEOMETRY")
read -r DASHBOARD_SIZE DASHBOARD_POSITION < <(parse_geometry "$DASHBOARD_GEOMETRY")
read -r -a EXTRA_CHROMIUM_FLAGS <<< "$CHROMIUM_FLAGS"

case "$KIOSK_MODE" in
  main|dual)
    ;;
  *)
    echo "Invalid KIOSK_MODE: $KIOSK_MODE. Use 'main' or 'dual'." >&2
    exit 1
    ;;
esac

CHROMIUM_PIDS=()
SCHEDULER_PID=""

mkdir -p "$MAIN_PROFILE_DIR" "$DASHBOARD_PROFILE_DIR"

wait_for_display() {
  if ! command -v xset >/dev/null 2>&1; then
    return 0
  fi

  for _ in $(seq 1 "$DISPLAY_WAIT_SECONDS"); do
    if xset q >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "X display is not ready: DISPLAY=${DISPLAY:-<unset>}" >&2
  return 1
}

configure_display_sleep() {
  case "$DISPLAY_SLEEP_MODE" in
    off)
      xset s off >/dev/null 2>&1 || true
      xset -dpms >/dev/null 2>&1 || true
      xset s noblank >/dev/null 2>&1 || true
      ;;
    idle)
      local timeout=$((IDLE_SLEEP_MINUTES * 60))
      xset +dpms >/dev/null 2>&1 || true
      xset dpms "$timeout" "$timeout" "$timeout" >/dev/null 2>&1 || true
      xset s "$timeout" >/dev/null 2>&1 || true
      ;;
    schedule)
      xset +dpms >/dev/null 2>&1 || true
      xset dpms 0 0 0 >/dev/null 2>&1 || true
      xset s off >/dev/null 2>&1 || true
      xset s noblank >/dev/null 2>&1 || true
      ;;
    both)
      local timeout=$((IDLE_SLEEP_MINUTES * 60))
      xset +dpms >/dev/null 2>&1 || true
      xset dpms "$timeout" "$timeout" "$timeout" >/dev/null 2>&1 || true
      xset s "$timeout" >/dev/null 2>&1 || true
      ;;
  esac
}

time_to_minutes() {
  local hhmm="$1"
  local hour="${hhmm%%:*}"
  local minute="${hhmm#*:}"
  echo $((10#$hour * 60 + 10#$minute))
}

in_sleep_window() {
  local now_minutes start_minutes end_minutes
  now_minutes=$(( 10#$(date +%H) * 60 + 10#$(date +%M) ))
  start_minutes="$(time_to_minutes "$SLEEP_START_TIME")"
  end_minutes="$(time_to_minutes "$SLEEP_END_TIME")"

  if [ "$start_minutes" -le "$end_minutes" ]; then
    [ "$now_minutes" -ge "$start_minutes" ] && [ "$now_minutes" -lt "$end_minutes" ]
  else
    [ "$now_minutes" -ge "$start_minutes" ] || [ "$now_minutes" -lt "$end_minutes" ]
  fi
}

run_display_sleep_scheduler() {
  local in_window_prev="0"

  while true; do
    if in_sleep_window; then
      xset dpms force off >/dev/null 2>&1 || true
      in_window_prev="1"
    else
      if [ "$in_window_prev" = "1" ]; then
        xset dpms force on >/dev/null 2>&1 || true
      fi
      in_window_prev="0"
    fi
    sleep "$SLEEP_CHECK_INTERVAL_SECONDS"
  done
}

cleanup() {
  trap - TERM INT HUP EXIT

  if [ -n "$SCHEDULER_PID" ] && kill -0 "$SCHEDULER_PID" >/dev/null 2>&1; then
    kill "$SCHEDULER_PID" >/dev/null 2>&1 || true
    wait "$SCHEDULER_PID" >/dev/null 2>&1 || true
  fi

  for pid in "${CHROMIUM_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait "${CHROMIUM_PIDS[@]}" >/dev/null 2>&1 || true
}

trap cleanup TERM INT HUP EXIT

wait_for_display

configure_display_sleep

if [ "$DISPLAY_SLEEP_MODE" = "schedule" ] || [ "$DISPLAY_SLEEP_MODE" = "both" ]; then
  run_display_sleep_scheduler &
  SCHEDULER_PID="$!"
fi

if [ "$ENABLE_FCITX" = "1" ] && command -v fcitx5 >/dev/null 2>&1; then
  export GTK_IM_MODULE="${GTK_IM_MODULE:-fcitx}"
  export QT_IM_MODULE="${QT_IM_MODULE:-fcitx}"
  export XMODIFIERS="${XMODIFIERS:-@im=fcitx}"

  if ! pgrep -u "$(id -u)" -x fcitx5 >/dev/null 2>&1; then
    fcitx5 -d >/tmp/mccb-kiosk-fcitx5.log 2>&1 || true
    sleep 1
  fi
fi

BASE_CHROMIUM_FLAGS=(
  --no-first-run
  --no-default-browser-check
  --disable-background-networking
  --disable-background-timer-throttling
  --disable-client-side-phishing-detection
  --disable-component-update
  --disable-default-apps
  --disable-extensions
  --disable-features=OptimizationGuideModelDownloading,OnDeviceModelExecution,Translate
  --disable-hang-monitor
  --disable-popup-blocking
  --disable-prompt-on-repost
  --disable-renderer-backgrounding
  --disable-smooth-scrolling
  --disable-sync
  --disable-translate
  --disable-dev-shm-usage
  --metrics-recording-only
  --password-store=basic
)

GPU_CHROMIUM_FLAGS=()
if [ "$ENABLE_GPU_TUNING" = "1" ]; then
  GPU_CHROMIUM_FLAGS=(
    --enable-gpu-rasterization
    --enable-zero-copy
    --ignore-gpu-blocklist
  )
fi

"$CHROMIUM_BIN" \
  "${BASE_CHROMIUM_FLAGS[@]}" \
  "${GPU_CHROMIUM_FLAGS[@]}" \
  "${EXTRA_CHROMIUM_FLAGS[@]}" \
  --user-data-dir="$MAIN_PROFILE_DIR" \
  --force-device-scale-factor="$MAIN_SCALE" \
  --new-window \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --window-position="$MAIN_POSITION" \
  --window-size="$MAIN_SIZE" \
  "${APP_URL}/#/" &
CHROMIUM_PIDS+=("$!")

if [ "$KIOSK_MODE" = "dual" ]; then
  "$CHROMIUM_BIN" \
    "${BASE_CHROMIUM_FLAGS[@]}" \
    "${GPU_CHROMIUM_FLAGS[@]}" \
    "${EXTRA_CHROMIUM_FLAGS[@]}" \
    --user-data-dir="$DASHBOARD_PROFILE_DIR" \
    --force-device-scale-factor="$DASHBOARD_SCALE" \
    --new-window \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --window-position="$DASHBOARD_POSITION" \
    --window-size="$DASHBOARD_SIZE" \
    "${APP_URL}/#/monitor" &
  CHROMIUM_PIDS+=("$!")
fi

wait "${CHROMIUM_PIDS[@]}"
