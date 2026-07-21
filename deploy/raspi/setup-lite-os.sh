#!/usr/bin/env bash
set -euo pipefail

TARGET_USER="${TARGET_USER:-$USER}"
INSTALL_KIOSK="${INSTALL_KIOSK:-1}"
INSTALL_JAPANESE_INPUT="${INSTALL_JAPANESE_INPUT:-1}"
ENABLE_AUTOLOGIN="${ENABLE_AUTOLOGIN:-1}"
SKIP_APT="${SKIP_APT:-0}"
INSTALL_NODE="${INSTALL_NODE:-1}"
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-24}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh" >&2
  exit 1
fi

if ! id "$TARGET_USER" >/dev/null 2>&1; then
  echo "TARGET_USER does not exist: $TARGET_USER" >&2
  exit 1
fi

if [ "${ALLOW_DESKTOP_OS:-0}" != "1" ] && \
  command -v dpkg-query >/dev/null 2>&1 && \
  dpkg-query -W -f='${Status}' raspberrypi-ui-mods 2>/dev/null | grep -q "install ok installed"; then
  echo "Raspberry Pi OS with Desktop is not supported. Use Raspberry Pi OS Lite 64-bit for this deployment." >&2
  echo "If this is an intentionally minimized Lite image with raspberrypi-ui-mods installed, rerun with ALLOW_DESKTOP_OS=1." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if [ "$SKIP_APT" != "1" ]; then
  apt-get update
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openssl \
    unzip \
    nginx

  if [ "$INSTALL_KIOSK" = "1" ]; then
    apt-get install -y --no-install-recommends \
      fontconfig \
      fonts-noto-cjk \
      fonts-noto-cjk-extra \
      fonts-noto-color-emoji \
      xserver-xorg \
      xserver-xorg-legacy \
      xinit \
      openbox \
      x11-xserver-utils \
      dbus-x11 \
      chromium
  fi

  if [ "$INSTALL_JAPANESE_INPUT" = "1" ]; then
    apt-get install -y --no-install-recommends \
      fontconfig \
      fonts-noto-cjk \
      fonts-noto-cjk-extra \
      fcitx5 \
      fcitx5-frontend-gtk3 \
      fcitx5-mozc
  fi
fi

node_sqlite_ready() {
  command -v node >/dev/null 2>&1 &&
    [ "$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)" -ge "$NODE_MAJOR_MIN" ] &&
    node -e "require('node:sqlite').DatabaseSync" >/dev/null 2>&1
}

if [ "$INSTALL_NODE" = "1" ] && ! node_sqlite_ready; then
  if [ "$SKIP_APT" = "1" ]; then
    echo "Node.js ${NODE_MAJOR_MIN}+ with node:sqlite is required, but SKIP_APT=1 prevents installation." >&2
    echo "Install Node.js ${NODE_MAJOR_MIN}+ manually, or rerun without SKIP_APT=1." >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install Node.js from NodeSource." >&2
    exit 1
  fi

  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_MIN}.x" | bash -
  apt-get install -y nodejs

  if ! node_sqlite_ready; then
    echo "Node.js ${NODE_MAJOR_MIN}+ was installed, but node:sqlite is still unavailable." >&2
    echo "Current node: $(command -v node >/dev/null 2>&1 && node -v || echo missing)" >&2
    exit 1
  fi
fi

if [ "$INSTALL_KIOSK" = "1" ]; then
  systemctl set-default multi-user.target
  usermod -aG video,render,input,tty "$TARGET_USER" || true

  mkdir -p /etc/X11
  cat >/etc/X11/Xwrapper.config <<WRAPPER
allowed_users=anybody
needs_root_rights=yes
WRAPPER

  mkdir -p /etc/X11/xorg.conf.d
  DRI_CARD=""
  for status_file in /sys/class/drm/card*-*/status; do
    if [ -e "$status_file" ] && grep -qx "connected" "$status_file"; then
      card_name="$(basename "$(dirname "$status_file")" | sed -E 's/^(card[0-9]+)-.*/\1/')"
      if [ -e "/dev/dri/$card_name" ]; then
        DRI_CARD="/dev/dri/$card_name"
        break
      fi
    fi
  done
  if [ -z "$DRI_CARD" ]; then
    DRI_CARD="$(find /dev/dri -maxdepth 1 -name 'card*' 2>/dev/null | sort | tail -n 1 || true)"
  fi
  if [ -n "$DRI_CARD" ]; then
    cat >/etc/X11/xorg.conf.d/99-mccb-kiosk.conf <<XORG
Section "Device"
    Identifier "MCCB KMS Device"
    Driver "modesetting"
    Option "kmsdev" "$DRI_CARD"
EndSection
XORG
  else
    rm -f /etc/X11/xorg.conf.d/99-mccb-kiosk.conf
  fi

  cat >/etc/systemd/system/mccb-xsession.service <<SERVICE
[Unit]
Description=MCCB Manager minimal X session
After=network-online.target mccb-manager.service
Wants=network-online.target

[Service]
Type=simple
User=$TARGET_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$TARGET_USER/.Xauthority
WorkingDirectory=/home/$TARGET_USER
TTYPath=/dev/tty7
TTYReset=yes
TTYVHangup=yes
StandardInput=tty
StandardOutput=journal
StandardError=journal
ExecStart=/usr/bin/xinit /usr/bin/openbox-session -- /usr/lib/xorg/Xorg :0 vt7 -keeptty -nolisten tcp
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable mccb-xsession.service
  systemctl restart mccb-xsession.service || true
fi

if [ "$INSTALL_JAPANESE_INPUT" = "1" ]; then
  USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
  mkdir -p "$USER_HOME/.config/fcitx5" "$USER_HOME/.config/environment.d"

  cat >"$USER_HOME/.config/fcitx5/profile" <<'FCITX_PROFILE'
[Groups/0]
Name=Default
Default Layout=jp
DefaultIM=mozc

[Groups/0/Items/0]
Name=keyboard-jp
Layout=

[Groups/0/Items/1]
Name=mozc
Layout=

[GroupOrder]
0=Default
FCITX_PROFILE

  cat >"$USER_HOME/.config/environment.d/90-mccb-ime.conf" <<'IME_ENV'
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS=@im=fcitx
IME_ENV

  chown -R "$TARGET_USER:$TARGET_USER" "$USER_HOME/.config/fcitx5" "$USER_HOME/.config/environment.d"
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
  1. Deploy the app with deploy/raspi/deploy-over-ssh.ps1 -StartKiosk.
  2. Reboot the Raspberry Pi, or restart mccb-xsession.service and mccb-kiosk.service.

Services:
  sudo systemctl status mccb-xsession.service
  sudo systemctl status mccb-manager.service
  systemctl --user status mccb-kiosk.service
MSG
