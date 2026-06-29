#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mccb-manager}"
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-24}"
ENABLE_KIOSK="${ENABLE_KIOSK:-1}"

if [ ! -d "$APP_DIR" ]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js ${NODE_MAJOR_MIN}+ on the Raspberry Pi image before offline deployment." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt "$NODE_MAJOR_MIN" ]; then
  echo "Node.js ${NODE_MAJOR_MIN}+ is required for node:sqlite. Current version: $(node -v)" >&2
  exit 1
fi

if ! node -e "require('node:sqlite').DatabaseSync" >/dev/null 2>&1; then
  echo "Current Node.js does not provide node:sqlite DatabaseSync. Install a newer Node.js 24 build." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "node_modules was not deployed. Run deploy-over-ssh.ps1 without -SkipBuild, or include node_modules in the package." >&2
  exit 1
fi

mkdir -p data/backups

NODE_BIN="$(command -v node)"
sudo tee /etc/systemd/system/mccb-manager.service >/dev/null <<SERVICE
[Unit]
Description=MCCB Manager app server
After=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable mccb-manager.service
sudo systemctl restart mccb-manager.service

if command -v nginx >/dev/null 2>&1; then
  sudo cp deploy/nginx/mccb-manager.conf /etc/nginx/sites-available/mccb-manager
  if [ ! -e /etc/nginx/sites-enabled/mccb-manager ]; then
    sudo ln -s /etc/nginx/sites-available/mccb-manager /etc/nginx/sites-enabled/mccb-manager
  fi
  if [ -e /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
  fi
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "nginx is not installed. Skipping port 80 reverse proxy; use http://<raspberry-pi-ip>:5000/#/."
fi

chmod +x deploy/kiosk/start-kiosk.sh

if [ "$ENABLE_KIOSK" = "1" ]; then
  if command -v chromium-browser >/dev/null 2>&1 || command -v chromium >/dev/null 2>&1; then
    if command -v xset >/dev/null 2>&1; then
      loginctl enable-linger "$USER" || true
      mkdir -p "$HOME/.config/systemd/user"
      cat > "$HOME/.config/systemd/user/mccb-kiosk.service" <<SERVICE
[Unit]
Description=MCCB Manager Chromium kiosk
After=graphical-session.target network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=DISPLAY=:0
Environment=GTK_IM_MODULE=fcitx
Environment=QT_IM_MODULE=fcitx
Environment=XMODIFIERS=@im=fcitx
Environment=APP_URL=http://127.0.0.1
Environment=MAIN_GEOMETRY=1920x1080+0+0
Environment=DASHBOARD_GEOMETRY=3840x2160+1920+0
Environment=DASHBOARD_SCALE=1.5
Environment=CHROMIUM_FLAGS=--disable-features=OptimizationGuideModelDownloading,OnDeviceModelExecution --disable-gpu-vsync
ExecStartPre=/bin/sleep 8
ExecStartPre=/usr/bin/xset s off
ExecStartPre=/usr/bin/xset -dpms
ExecStartPre=/usr/bin/xset s noblank
ExecStart=$APP_DIR/deploy/kiosk/start-kiosk.sh
ExecStopPost=-/usr/bin/pkill -u %u -f /tmp/mccb-kiosk-
KillMode=mixed
TimeoutStopSec=10
SendSIGKILL=yes
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SERVICE
      systemctl --user daemon-reload
      systemctl --user enable mccb-kiosk.service
    else
      echo "xset is not installed. Skipping kiosk service registration."
    fi
  else
    echo "Chromium is not installed. Skipping kiosk service registration."
  fi
fi

cat <<MSG
Setup completed.

App:
  http://<raspberry-pi-ip>/#/
  http://<raspberry-pi-ip>:5000/#/
  http://<raspberry-pi-ip>/#/monitor
  http://<raspberry-pi-ip>:5000/#/monitor
MSG
