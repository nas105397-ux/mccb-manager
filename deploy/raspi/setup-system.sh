#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mccb-manager}"

if [ ! -d "$APP_DIR" ]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

sudo apt update
sudo apt install -y nginx chromium-browser || sudo apt install -y nginx chromium

npm install
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

pm2 start ecosystem.config.cjs
pm2 save

sudo cp deploy/nginx/mccb-manager.conf /etc/nginx/sites-available/mccb-manager
if [ ! -e /etc/nginx/sites-enabled/mccb-manager ]; then
  sudo ln -s /etc/nginx/sites-available/mccb-manager /etc/nginx/sites-enabled/mccb-manager
fi
sudo nginx -t
sudo systemctl reload nginx

mkdir -p "$HOME/.config/systemd/user"
cp deploy/kiosk/mccb-kiosk.service "$HOME/.config/systemd/user/mccb-kiosk.service"
chmod +x deploy/kiosk/start-kiosk.sh
systemctl --user daemon-reload
systemctl --user enable mccb-kiosk.service

loginctl enable-linger "$USER" || true

cat <<MSG
Setup completed.

Run this once to generate and enable the PM2 boot command:
  pm2 startup

Then reboot:
  sudo reboot

App:
  http://<raspberry-pi-ip>/#/
  http://<raspberry-pi-ip>/#/monitor
MSG
