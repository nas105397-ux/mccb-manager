#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash deploy/raspi/install-star-webusb-driver.sh" >&2
  exit 1
fi

cat >/etc/udev/rules.d/50-starusb.rules <<'UDEV_RULE'
# Star Micronics printers for StarXpand SDK for Web / WebUSB.
SUBSYSTEM=="usb", ATTR{idVendor}=="0519", MODE="0666", TAG+="uaccess"
UDEV_RULE

cat >/etc/modprobe.d/mccb-star-webusb.conf <<'MODPROBE_CONF'
# StarXpand SDK for Web needs direct WebUSB access.
# Prevent Linux usblp from claiming Star receipt printers before Chromium.
blacklist usblp
MODPROBE_CONF

udevadm control --reload-rules
udevadm trigger

for device in /sys/bus/usb/drivers/usblp/*:*; do
  if [ -e "$device" ]; then
    echo "unbind ${device##*/} from usblp"
    echo "${device##*/}" >/sys/bus/usb/drivers/usblp/unbind || true
  fi
done

if lsmod | grep -q '^usblp'; then
  modprobe -r usblp || true
fi

for vendor_file in /sys/bus/usb/devices/*/idVendor; do
  if [ -e "$vendor_file" ] && [ "$(cat "$vendor_file")" = "0519" ]; then
    device_dir="$(dirname "$vendor_file")"
    busnum="$(cat "$device_dir/busnum" 2>/dev/null || true)"
    devnum="$(cat "$device_dir/devnum" 2>/dev/null || true)"
    if [ -n "$busnum" ] && [ -n "$devnum" ]; then
      device_node="/dev/bus/usb/$(printf '%03d' "$busnum")/$(printf '%03d' "$devnum")"
      if [ -e "$device_node" ]; then
        chmod 0666 "$device_node" || true
      fi
    fi
  fi
done

echo
echo "Detected Star USB devices:"
if command -v lsusb >/dev/null 2>&1; then
  lsusb -d 0519: || true
else
  echo "  lsusb is not installed."
fi

echo
echo "usblp module status:"
if lsmod | grep -q '^usblp'; then
  lsmod | grep '^usblp' || true
else
  echo "  usblp is not loaded."
fi

echo
echo "Star USB device node permissions:"
for vendor_file in /sys/bus/usb/devices/*/idVendor; do
  if [ -e "$vendor_file" ] && [ "$(cat "$vendor_file")" = "0519" ]; then
    device_dir="$(dirname "$vendor_file")"
    busnum="$(cat "$device_dir/busnum" 2>/dev/null || true)"
    devnum="$(cat "$device_dir/devnum" 2>/dev/null || true)"
    if [ -n "$busnum" ] && [ -n "$devnum" ]; then
      device_node="/dev/bus/usb/$(printf '%03d' "$busnum")/$(printf '%03d' "$devnum")"
      ls -l "$device_node" 2>/dev/null || true
    fi
  fi
done

cat <<'MSG'
Star WebUSB driver setup completed.

Next:
  1. Unplug and replug the Star printer USB cable, or reboot the Raspberry Pi.
  2. Open the app with Chromium over localhost or trusted HTTPS.
  3. Use 管理者画面 -> スター精密プリンター接続.

Restore:
  sudo rm -f /etc/udev/rules.d/50-starusb.rules /etc/modprobe.d/mccb-star-webusb.conf
  sudo udevadm control --reload-rules
  sudo reboot
MSG
