#!/usr/bin/env bash
set -euo pipefail

STATIC_IP="${STATIC_IP:-}"
STATIC_GATEWAY="${STATIC_GATEWAY:-}"
STATIC_DNS="${STATIC_DNS:-}"
STATIC_CONNECTION="${STATIC_CONNECTION:-}"
STATIC_APPLY_DELAY="${STATIC_APPLY_DELAY:-2}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo STATIC_IP=192.168.40.111/24 bash deploy/raspi/setup-static-ip.sh" >&2
  exit 1
fi

if [ -z "$STATIC_IP" ]; then
  echo "STATIC_IP is required, e.g. STATIC_IP=192.168.40.111/24" >&2
  exit 1
fi

case "$STATIC_IP" in
  */*) ;;
  *)
    echo "STATIC_IP must include a prefix length, e.g. 192.168.40.111/24" >&2
    exit 1
    ;;
esac

if ! command -v nmcli >/dev/null 2>&1; then
  echo "nmcli (NetworkManager) is required to configure a static IP." >&2
  exit 1
fi

if [ -z "$STATIC_CONNECTION" ]; then
  STATIC_CONNECTION="$(nmcli -t -f NAME,DEVICE connection show --active | awk -F: '$2 != "lo" && $2 != "" {print $1; exit}')"
fi

if [ -z "$STATIC_CONNECTION" ]; then
  echo "Could not detect an active network connection. Set STATIC_CONNECTION explicitly, e.g. STATIC_CONNECTION=\"Wired connection 1\"." >&2
  exit 1
fi

if ! nmcli -t -f NAME connection show | grep -Fxq "$STATIC_CONNECTION"; then
  echo "Connection not found: $STATIC_CONNECTION" >&2
  echo "Available connections:" >&2
  nmcli -t -f NAME connection show >&2
  exit 1
fi

echo "Connection : $STATIC_CONNECTION"
echo "Static IP  : $STATIC_IP"
if [ -n "$STATIC_GATEWAY" ]; then
  echo "Gateway    : $STATIC_GATEWAY"
fi
if [ -n "$STATIC_DNS" ]; then
  echo "DNS        : $STATIC_DNS"
fi
echo
echo "Applying in ${STATIC_APPLY_DELAY}s in the background."
echo "If this address differs from the one used for the current SSH session, the session will disconnect."
echo "Reconnect afterwards using: ssh <user>@${STATIC_IP%%/*}"

NMCLI_MODIFY_ARGS=(connection modify "$STATIC_CONNECTION" ipv4.method manual ipv4.addresses "$STATIC_IP")
if [ -n "$STATIC_GATEWAY" ]; then
  NMCLI_MODIFY_ARGS+=(ipv4.gateway "$STATIC_GATEWAY")
fi
if [ -n "$STATIC_DNS" ]; then
  NMCLI_MODIFY_ARGS+=(ipv4.dns "$STATIC_DNS" ipv4.ignore-auto-dns yes)
fi

nmcli "${NMCLI_MODIFY_ARGS[@]}"

# Apply the address change slightly later, detached from this shell, so an SSH
# session using the old address can close cleanly instead of hanging on the
# now-unreachable connection while this script is still running.
nohup bash -c "
  sleep '$STATIC_APPLY_DELAY'
  nmcli connection down '$STATIC_CONNECTION' >/tmp/mccb-static-ip-apply.log 2>&1 || true
  nmcli connection up '$STATIC_CONNECTION' >>/tmp/mccb-static-ip-apply.log 2>&1
" >/dev/null 2>&1 </dev/null &

echo "Static IP configuration queued (log: /tmp/mccb-static-ip-apply.log)."
