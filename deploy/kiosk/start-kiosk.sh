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
# 以下のスリープ設定はサーバー(管理画面)から配信される値で上書きされる。
# ここでの指定は、サーバーへ接続できないときのフォールバックとして使う。
DISPLAY_SLEEP_MODE="${DISPLAY_SLEEP_MODE:-off}"
IDLE_SLEEP_MINUTES="${IDLE_SLEEP_MINUTES:-15}"
SLEEP_START_TIME="${SLEEP_START_TIME:-}"
SLEEP_END_TIME="${SLEEP_END_TIME:-}"
# 消灯時間帯に画面へ触れたあと、再消灯するまで点灯を維持する分数。
WAKE_GRACE_MINUTES="${WAKE_GRACE_MINUTES:-5}"
SLEEP_CHECK_INTERVAL_SECONDS="${SLEEP_CHECK_INTERVAL_SECONDS:-15}"
SLEEP_POLICY_URL="${SLEEP_POLICY_URL:-${APP_URL}/api/kiosk/sleep-policy}"
SLEEP_POLICY_FETCH_INTERVAL_SECONDS="${SLEEP_POLICY_FETCH_INTERVAL_SECONDS:-60}"
CONFIGURE_DISPLAY_LAYOUT="${CONFIGURE_DISPLAY_LAYOUT:-1}"
MAIN_OUTPUT="${MAIN_OUTPUT:-}"
DASHBOARD_OUTPUT="${DASHBOARD_OUTPUT:-}"

export XCURSOR_SIZE

case "$DISPLAY_SLEEP_MODE" in
  off|idle|schedule|both|always)
    ;;
  *)
    echo "Invalid DISPLAY_SLEEP_MODE: $DISPLAY_SLEEP_MODE. Use 'off', 'idle', 'schedule', 'both', or 'always'." >&2
    exit 1
    ;;
esac

# 時刻未設定でも、サーバーから配信された時点で時間帯消灯が有効になる。
if [ "$DISPLAY_SLEEP_MODE" = "schedule" ] || [ "$DISPLAY_SLEEP_MODE" = "both" ]; then
  if [ -z "$SLEEP_START_TIME" ] || [ -z "$SLEEP_END_TIME" ]; then
    echo "警告: SLEEP_START_TIME / SLEEP_END_TIME (HH:MM) が未設定のため、サーバーから設定を取得するまで時間帯消灯は行いません。" >&2
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

  printf '%s %s,%s %sx%s\n' "$size" "$x" "$y" "$x" "$y"
}

read -r MAIN_SIZE MAIN_POSITION MAIN_XRANDR_POS < <(parse_geometry "$MAIN_GEOMETRY")
read -r DASHBOARD_SIZE DASHBOARD_POSITION DASHBOARD_XRANDR_POS < <(parse_geometry "$DASHBOARD_GEOMETRY")
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

set_output_mode() {
  local output="$1" mode="$2" pos="$3"
  shift 3
  local err_log="/tmp/mccb-kiosk-xrandr-err.log"

  if xrandr --output "$output" --mode "$mode" --pos "$pos" "$@" 2>"$err_log"; then
    return 0
  fi

  if command -v cvt >/dev/null 2>&1; then
    local width="${mode%%x*}" height="${mode#*x}"
    local modeline
    modeline="$(cvt "$width" "$height" 60 2>/dev/null | awk '/^Modeline/{sub(/^Modeline /,""); print}' | tr -d '"')"
    if [ -n "$modeline" ]; then
      local modeline_name="${modeline%% *}"
      xrandr --newmode $modeline >/dev/null 2>&1 || true
      xrandr --addmode "$output" "$modeline_name" >/dev/null 2>&1 || true
      if xrandr --output "$output" --mode "$modeline_name" --pos "$pos" "$@" 2>"$err_log"; then
        return 0
      fi
    fi
  fi

  echo "警告: 出力 $output を $mode に設定できませんでした: $(cat "$err_log" 2>/dev/null)" >&2
  return 1
}

configure_display_layout() {
  if [ "$CONFIGURE_DISPLAY_LAYOUT" != "1" ] || ! command -v xrandr >/dev/null 2>&1; then
    return 0
  fi

  local connected
  connected="$(xrandr --query 2>/dev/null | awk '/ connected/{print $1}')"

  local main_out dashboard_out
  main_out="${MAIN_OUTPUT:-$(printf '%s\n' "$connected" | sed -n '1p')}"
  dashboard_out="${DASHBOARD_OUTPUT:-$(printf '%s\n' "$connected" | sed -n '2p')}"

  if [ -z "$main_out" ]; then
    echo "接続中のディスプレイ出力を検出できませんでした。画面レイアウト設定をスキップします。" >&2
    return 0
  fi

  set_output_mode "$main_out" "$MAIN_SIZE" "$MAIN_XRANDR_POS" --rotate normal --primary

  if [ "$KIOSK_MODE" = "dual" ]; then
    if [ -z "$dashboard_out" ]; then
      echo "警告: ダッシュボード用のディスプレイ出力が見つかりません。2画面目のケーブル接続を確認してください。" >&2
    else
      set_output_mode "$dashboard_out" "$DASHBOARD_SIZE" "$DASHBOARD_XRANDR_POS" --rotate normal
    fi
  else
    local out
    for out in $connected; do
      if [ "$out" != "$main_out" ]; then
        xrandr --output "$out" --off >/dev/null 2>&1 || true
      fi
    done
  fi
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
    schedule|always)
      # 消灯タイミングはこのスクリプトが制御するため、X 側の自動消灯は止めておく。
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

# 現在のモードで「消灯しているべき時間帯」かどうかを判定する。
in_display_off_window() {
  case "$DISPLAY_SLEEP_MODE" in
    always)
      return 0
      ;;
    schedule|both)
      if [ -z "$SLEEP_START_TIME" ] || [ -z "$SLEEP_END_TIME" ]; then
        return 1
      fi
      in_sleep_window
      ;;
    *)
      return 1
      ;;
  esac
}

# xset の報告するモニター状態。強制消灯後に "On" へ戻っていれば、画面が操作されたと判断できる。
get_monitor_state() {
  # set -e / pipefail でループごと落ちないよう、取得失敗時は空文字を返す。
  xset q 2>/dev/null | sed -n 's/.*Monitor is \(.*\)$/\1/p' | head -n 1 || true
}

# サーバーから当日ぶんの実効ポリシーを取得する。期間設定の判定はサーバー側で解決済み。
fetch_sleep_policy() {
  if [ -z "$SLEEP_POLICY_URL" ] || ! command -v curl >/dev/null 2>&1; then
    return 1
  fi

  local body
  body="$(curl -fsSk --max-time 5 "$SLEEP_POLICY_URL" 2>/dev/null)" || return 1
  [ -n "$body" ] || return 1

  local key value mode="" idle="" start="" end="" grace=""
  while IFS='=' read -r key value; do
    case "$key" in
      mode) mode="$value" ;;
      idle_minutes) idle="$value" ;;
      sleep_start) start="$value" ;;
      sleep_end) end="$value" ;;
      wake_grace_minutes) grace="$value" ;;
    esac
  done <<< "$body"

  # 壊れた応答で運用中の設定を壊さないよう、全項目を検証してから反映する。
  case "$mode" in
    off|idle|schedule|both|always) ;;
    *) return 1 ;;
  esac
  [[ "$idle" =~ ^[0-9]{1,4}$ ]] || return 1
  [[ "$grace" =~ ^[0-9]{1,4}$ ]] || return 1
  [[ "$start" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || return 1
  [[ "$end" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || return 1

  DISPLAY_SLEEP_MODE="$mode"
  IDLE_SLEEP_MINUTES="$idle"
  SLEEP_START_TIME="$start"
  SLEEP_END_TIME="$end"
  WAKE_GRACE_MINUTES="$grace"
  return 0
}

# 画面消灯の唯一の制御点。設定の定期取得、時間帯判定、復帰後の点灯維持をここで行う。
run_display_sleep_controller() {
  local applied_signature=""
  local forced_off="0"
  local grace_until="0"
  local last_fetch_at="0"
  local now signature monitor_state

  while true; do
    now="$(date +%s)"

    if [ "$((now - last_fetch_at))" -ge "$SLEEP_POLICY_FETCH_INTERVAL_SECONDS" ]; then
      fetch_sleep_policy || true
      last_fetch_at="$now"
    fi

    signature="${DISPLAY_SLEEP_MODE}/${IDLE_SLEEP_MINUTES}"
    if [ "$signature" != "$applied_signature" ]; then
      # モードや無操作時間が変わったときだけ xset の基本設定をやり直す。
      configure_display_sleep
      applied_signature="$signature"
      # forced_off は引き継ぐ。消灯させた事実を失うと、点灯に戻すべき場面で戻せなくなる。
      grace_until="0"
    fi

    if in_display_off_window; then
      monitor_state="$(get_monitor_state)"
      if [ "$forced_off" = "1" ] && [ "$monitor_state" = "On" ]; then
        # 消灯中に画面へ触れて復帰した。指定分数が過ぎるまで再消灯しない。
        grace_until="$((now + WAKE_GRACE_MINUTES * 60))"
        forced_off="0"
      fi

      if [ "$now" -ge "$grace_until" ]; then
        xset dpms force off >/dev/null 2>&1 || true
        forced_off="1"
      fi
    else
      if [ "$forced_off" = "1" ]; then
        xset dpms force on >/dev/null 2>&1 || true
      elif [ "$DISPLAY_SLEEP_MODE" = "off" ] && [ "$(get_monitor_state)" != "On" ]; then
        # 常時点灯の設定なのに消灯している（サービス再起動直後など）ときは点灯へ戻す。
        xset dpms force on >/dev/null 2>&1 || true
      fi
      forced_off="0"
      grace_until="0"
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

configure_display_layout

configure_display_sleep

# モードはサーバー配信で随時変わるため、コントローラは常に起動しておく。
run_display_sleep_controller &
SCHEDULER_PID="$!"

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
