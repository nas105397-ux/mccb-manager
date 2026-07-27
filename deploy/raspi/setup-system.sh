#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/mccb-manager}"
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-24}"
ENABLE_KIOSK="${ENABLE_KIOSK:-1}"
MCCB_SERVER_HOST="${MCCB_SERVER_HOST:-192.168.40.111}"
MCCB_KIOSK_HOST="${MCCB_KIOSK_HOST:-localhost}"
KIOSK_MODE="${KIOSK_MODE:-dual}"
MAIN_GEOMETRY="${MAIN_GEOMETRY:-1920x1080+0+0}"
DASHBOARD_GEOMETRY="${DASHBOARD_GEOMETRY:-3840x2160+1920+0}"
MAIN_SCALE="${MAIN_SCALE:-1}"
DASHBOARD_SCALE="${DASHBOARD_SCALE:-1.5}"

if [ ! -d "$APP_DIR" ]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

if [ "${ALLOW_DESKTOP_OS:-0}" != "1" ] && \
  command -v dpkg-query >/dev/null 2>&1 && \
  dpkg-query -W -f='${Status}' raspberrypi-ui-mods 2>/dev/null | grep -q "install ok installed"; then
  echo "Raspberry Pi OS with Desktop is not supported. Use Raspberry Pi OS Lite 64-bit for this deployment." >&2
  echo "If this is an intentionally minimized Lite image with raspberrypi-ui-mods installed, rerun with ALLOW_DESKTOP_OS=1." >&2
  exit 1
fi

cd "$APP_DIR"

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  for nvm_dir in "${NVM_DIR:-}" "$HOME/.nvm" "/usr/local/nvm"; do
    if [ -n "$nvm_dir" ] && [ -s "$nvm_dir/nvm.sh" ]; then
      # shellcheck source=/dev/null
      . "$nvm_dir/nvm.sh"
      if command -v nvm >/dev/null 2>&1; then
        nvm use --silent default >/dev/null 2>&1 || nvm use --silent "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true
      fi
      break
    fi
  done
fi

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

if [ ! -d node_modules/express ] || [ ! -d node_modules/cors ]; then
  echo "Server runtime dependencies were not deployed. Run deploy-over-ssh.ps1 without -SkipBuild, or restore node_modules with npm ci." >&2
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
Environment=HOST=127.0.0.1
Environment=PORT=5000
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable mccb-manager.service
sudo systemctl restart mccb-manager.service

if command -v nginx >/dev/null 2>&1; then
  CERT_PATH="/etc/ssl/certs/mccb-manager-selfsigned.crt"
  KEY_PATH="/etc/ssl/private/mccb-manager-selfsigned.key"
  TRUSTED_CERT_PATH="/usr/local/share/ca-certificates/mccb-manager-selfsigned.crt"

  if [ "${MCCB_REGENERATE_CERT:-0}" = "1" ]; then
    echo "MCCB_REGENERATE_CERT=1: removing existing HTTPS certificate."
    sudo rm -f "$CERT_PATH" "$KEY_PATH"
  fi

  if sudo test -f "$CERT_PATH"; then
    echo "HTTPS certificate file exists: $CERT_PATH"
  else
    echo "HTTPS certificate file is missing: $CERT_PATH"
  fi
  if sudo test -f "$KEY_PATH"; then
    echo "HTTPS private key file exists: $KEY_PATH"
  else
    echo "HTTPS private key file is missing: $KEY_PATH"
  fi

  if ! sudo test -f "$CERT_PATH" || ! sudo test -f "$KEY_PATH"; then
    if ! command -v openssl >/dev/null 2>&1; then
      echo "openssl is required to create the HTTPS certificate. Install openssl and rerun setup." >&2
      exit 1
    fi

    LOCAL_IP="$(hostname -I | awk '{print $1}')"
    LOCAL_HOSTNAME="$(hostname)"
    OPENSSL_CONFIG="$(mktemp)"
    cat > "$OPENSSL_CONFIG" <<SSL_CONFIG
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = $LOCAL_HOSTNAME

[v3_req]
subjectAltName = @alt_names
basicConstraints = critical,CA:TRUE
keyUsage = critical, digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = $LOCAL_HOSTNAME
DNS.2 = ${LOCAL_HOSTNAME}.local
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = $MCCB_SERVER_HOST
SSL_CONFIG
    DNS_INDEX=4
    for EXTRA_DNS in $(echo "${MCCB_CERT_EXTRA_DNS:-}" | tr ',;' '  '); do
      if [ -n "$EXTRA_DNS" ]; then
        echo "DNS.$DNS_INDEX = $EXTRA_DNS" >> "$OPENSSL_CONFIG"
        DNS_INDEX=$((DNS_INDEX + 1))
      fi
    done
    IP_INDEX=3
    if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "$MCCB_SERVER_HOST" ]; then
      echo "IP.$IP_INDEX = $LOCAL_IP" >> "$OPENSSL_CONFIG"
      IP_INDEX=$((IP_INDEX + 1))
    fi
    for EXTRA_IP in $(echo "${MCCB_CERT_EXTRA_IPS:-}" | tr ',;' '  '); do
      if [ -n "$EXTRA_IP" ] && [ "$EXTRA_IP" != "$MCCB_SERVER_HOST" ] && [ "$EXTRA_IP" != "$LOCAL_IP" ]; then
        echo "IP.$IP_INDEX = $EXTRA_IP" >> "$OPENSSL_CONFIG"
        IP_INDEX=$((IP_INDEX + 1))
      fi
    done

    sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -config "$OPENSSL_CONFIG"
    rm -f "$OPENSSL_CONFIG"
    sudo chmod 600 "$KEY_PATH"
    echo "Created HTTPS certificate:"
  else
    echo "Using existing HTTPS certificate:"
  fi
  openssl x509 -in "$CERT_PATH" -noout -fingerprint -sha256 -dates || true

  if command -v update-ca-certificates >/dev/null 2>&1; then
    if [ ! -f "$TRUSTED_CERT_PATH" ] || ! sudo cmp -s "$CERT_PATH" "$TRUSTED_CERT_PATH"; then
      sudo cp "$CERT_PATH" "$TRUSTED_CERT_PATH"
      sudo update-ca-certificates
    else
      echo "Local trusted certificate is already up to date."
    fi
  fi

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
  echo "nginx is not installed. Skipping HTTPS reverse proxy; use http://<raspberry-pi-ip>:5000/#/."
fi

chmod +x deploy/kiosk/start-kiosk.sh
chmod +x deploy/raspi/install-star-webusb-driver.sh

sudo tee /etc/systemd/system/mccb-star-webusb.service >/dev/null <<SERVICE
[Unit]
Description=MCCB Manager Star WebUSB device setup
After=systemd-udevd.service local-fs.target
Before=mccb-manager.service

[Service]
Type=oneshot
ExecStart=/bin/bash $APP_DIR/deploy/raspi/install-star-webusb-driver.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable mccb-star-webusb.service
sudo systemctl restart mccb-star-webusb.service || true

if [ "$ENABLE_KIOSK" = "1" ]; then
  if command -v chromium-browser >/dev/null 2>&1 || command -v chromium >/dev/null 2>&1; then
    if command -v xset >/dev/null 2>&1; then
      loginctl enable-linger "$USER" || true
      mkdir -p "$HOME/.config/systemd/user" "$HOME/.config/mccb-kiosk"
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
Environment=XCURSOR_SIZE=24
Environment=APP_URL=https://$MCCB_KIOSK_HOST
Environment=KIOSK_MODE=$KIOSK_MODE
Environment=MAIN_GEOMETRY=$MAIN_GEOMETRY
Environment=DASHBOARD_GEOMETRY=$DASHBOARD_GEOMETRY
Environment=MAIN_SCALE=$MAIN_SCALE
Environment=DASHBOARD_SCALE=$DASHBOARD_SCALE
Environment=ENABLE_GPU_TUNING=0
Environment="CHROMIUM_FLAGS=--disable-gpu-vsync --ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=https://$MCCB_KIOSK_HOST"
EnvironmentFile=-%h/.config/mccb-kiosk/kiosk.env
ExecStartPre=/bin/sleep 8
ExecStartPre=-/usr/bin/xset s off
ExecStartPre=-/usr/bin/xset -dpms
ExecStartPre=-/usr/bin/xset s noblank
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
  https://$MCCB_SERVER_HOST/#/
  http://<raspberry-pi-ip>:5000/#/
  https://$MCCB_SERVER_HOST/#/monitor
  http://<raspberry-pi-ip>:5000/#/monitor

Kiosk display URL (this Raspberry Pi only):
  https://$MCCB_KIOSK_HOST/#/

HTTPS certificate:
  /etc/ssl/certs/mccb-manager-selfsigned.crt
  Install this certificate as trusted on client devices before using Star WebUSB over LAN.
MSG
