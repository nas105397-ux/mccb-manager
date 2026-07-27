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

export XCURSOR_SIZE

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

cleanup() {
  trap - TERM INT HUP EXIT

  for pid in "${CHROMIUM_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait "${CHROMIUM_PIDS[@]}" >/dev/null 2>&1 || true
}

trap cleanup TERM INT HUP EXIT

wait_for_display

xset s off >/dev/null 2>&1 || true
xset -dpms >/dev/null 2>&1 || true
xset s noblank >/dev/null 2>&1 || true

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
