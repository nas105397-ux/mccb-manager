#!/usr/bin/env bash
set -euo pipefail

TARGET_USER="${TARGET_USER:-$USER}"
INSTALL_KIOSK="${INSTALL_KIOSK:-1}"
INSTALL_JAPANESE_INPUT="${INSTALL_JAPANESE_INPUT:-0}"
ENABLE_AUTOLOGIN="${ENABLE_AUTOLOGIN:-1}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh" >&2
  exit 1
fi

if ! id "$TARGET_USER" >/dev/null 2>&1; then
  echo "TARGET_USER does not exist: $TARGET_USER" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  unzip \
  nginx

if [ "$INSTALL_KIOSK" = "1" ]; then
  apt-get install -y --no-install-recommends \
    xserver-xorg \
    xinit \
    openbox \
    x11-xserver-utils \
    dbus-x11 \
    chromium
fi

if [ "$INSTALL_JAPANESE_INPUT" = "1" ]; then
  apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    fcitx5 \
    fcitx5-mozc
fi

if [ "$INSTALL_KIOSK" = "1" ]; then
  systemctl set-default multi-user.target

  cat >/etc/systemd/system/mccb-xsession.service <<SERVICE
[Unit]
Description=MCCB Manager minimal X session
After=network-online.target mccb-manager.service
Wants=network-online.target

[Service]
Type=simple
User=$TARGET_USER
PAMName=login
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$TARGET_USER/.Xauthority
WorkingDirectory=/home/$TARGET_USER
ExecStart=/usr/bin/startx /usr/bin/openbox-session -- :0 -nocursor
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable mccb-xsession.service
fi

if [ "$ENABLE_AUTOLOGIN" = "1" ]; then
  mkdir -p /etc/systemd/system/getty@tty1.service.d
  cat >/etc/systemd/system/getty@tty1.service.d/autologin.conf <<SERVICE
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $TARGET_USER --noclear %I \$TERM
SERVICE
fi

loginctl enable-linger "$TARGET_USER" || true

cat <<MSG
Raspberry Pi OS Lite base setup finished.

Next:
  1. Install Node.js 24+.
  2. Deploy the app with deploy/raspi/deploy-over-ssh.ps1 -StartKiosk.
  3. Reboot the Raspberry Pi.

Services:
  sudo systemctl status mccb-xsession.service
  sudo systemctl status mccb-manager.service
  systemctl --user status mccb-kiosk.service
MSG
