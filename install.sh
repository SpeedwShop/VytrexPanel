#!/usr/bin/env bash
# ==========================================================================
#  Vytrex Panel — installer for Ubuntu / Debian VPS
#  One-line install:
#    bash <(curl -Ls https://raw.githubusercontent.com/<YOU>/vytrex-panel/main/install.sh)
#
#  Installs: system deps, Xray-core, the Vytrex Panel (FastAPI/uvicorn),
#  a systemd service, and (optionally) a Let's Encrypt certificate via acme.sh.
# ==========================================================================
set -euo pipefail

# ----- edit this if you fork the repo -----
# ----- edit these two lines if you fork the repo -----
VYTREX_SLUG="${VYTREX_SLUG:-SpeedwShop/VytrexPanel}"     # github <user>/<repo>
VYTREX_BRANCH="${VYTREX_BRANCH:-main}"
VYTREX_REPO="${VYTREX_REPO:-https://github.com/${VYTREX_SLUG}.git}"
INSTALL_DIR="/opt/vytrex-panel"
XRAY_CONFIG="/usr/local/etc/xray/config.json"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; CYN='\033[0;36m'; NC='\033[0m'
info(){ echo -e "${CYN}[*]${NC} $*"; }
ok(){   echo -e "${GRN}[✓]${NC} $*"; }
warn(){ echo -e "${YLW}[!]${NC} $*"; }
err(){  echo -e "${RED}[x]${NC} $*" >&2; }

# ---------------------------------------------------------------- root check
[[ $EUID -eq 0 ]] || { err "Please run as root (sudo bash install.sh)"; exit 1; }

# ---------------------------------------------------------------- OS check
if ! command -v apt-get >/dev/null 2>&1; then
  err "This installer supports Ubuntu/Debian (apt) only."; exit 1
fi

# ---------------------------------------------------------------- inputs
PANEL_PORT="${PANEL_PORT:-}"
ADMIN_USER="${ADMIN_USER:-}"
ADMIN_PASS="${ADMIN_PASS:-}"
PANEL_DOMAIN="${PANEL_DOMAIN:-}"

ask(){ local p="$1" d="$2" v; read -rp "$(echo -e "${CYN}?${NC} $p ${d:+[$d]}: ")" v; echo "${v:-$d}"; }

echo -e "${GRN}"
echo "  ╦  ╦╦ ╦╔╦╗╦═╗╔═╗═╗ ╦   ╔═╗╔═╗╔╗╔╔═╗╦  "
echo "  ╚╗╔╝╚╦╝ ║ ╠╦╝║╣ ╔╩╦╝   ╠═╝╠═╣║║║║╣ ║  "
echo "   ╚╝  ╩  ╩ ╩╚═╚═╝╩ ╚═   ╩  ╩ ╩╝╚╝╚═╝╩═╝"
echo -e "${NC}   Xray management panel · Ubuntu/Debian\n"

# port: random or manual (default 2099)
if [[ -z "$PANEL_PORT" ]]; then
  echo -e "${CYN}?${NC} ${GRN}Panel port${NC}"
  echo "     1) Random"
  echo "     2) Choose manually (default 2099)"
  PMODE="$(ask 'Select' '2')"
  if [[ "$PMODE" == "1" ]]; then
    PANEL_PORT=$(( (RANDOM % 20000) + 20000 )); info "Random panel port: $PANEL_PORT"
  else
    PANEL_PORT="$(ask 'Enter panel port' '2099')"
  fi
fi
[[ -z "$ADMIN_USER" ]] && ADMIN_USER="$(ask 'Admin username' 'admin')"
if [[ -z "$ADMIN_PASS" ]]; then
  read -rsp "$(echo -e "${CYN}?${NC} Admin password [random if empty]: ")" ADMIN_PASS; echo
fi
[[ -z "$ADMIN_PASS" ]] && ADMIN_PASS="$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)"

# secret panel path (web base path) — required in the URL; blank => auto-generate
if [[ -z "${PANEL_PATH:-}" ]]; then
  echo -e "${CYN}?${NC} ${GRN}Secret panel path${NC}"
  echo "     1) Auto-generate random path (recommended)"
  echo "     2) Choose manually"
  XMODE="$(ask 'Select' '1')"
  if [[ "$XMODE" == "2" ]]; then
    PANEL_PATH="$(ask 'Enter path (letters/numbers, no slash)' '')"
  fi
  PANEL_PATH="$(echo "${PANEL_PATH:-}" | tr -cd 'A-Za-z0-9_-')"
fi

# SSL mode
if [[ -z "${SSL_MODE:-}" ]]; then
  echo -e "${CYN}?${NC} ${GRN}SSL for the panel${NC}"
  echo "     1) SSL for a DOMAIN (Let's Encrypt)"
  echo "     2) SSL for the server IP (self-signed)"
  echo "     3) None (plain HTTP)"
  SSL_MODE="$(ask 'Select' '3')"
fi
[[ "$SSL_MODE" == "1" && -z "$PANEL_DOMAIN" ]] && PANEL_DOMAIN="$(ask 'Domain (A record must point here, port 80 free)' '')"

# optional custom DNS for Xray
if [[ -z "${DNS_SERVERS:-}" ]]; then
  WANT_DNS="$(ask 'Set custom DNS for Xray? (y/N)' 'n')"
  if [[ "$WANT_DNS" =~ ^[Yy] ]]; then
    DNS_SERVERS="$(ask 'DNS servers comma-separated (e.g. 1.1.1.1,8.8.8.8)' '1.1.1.1,8.8.8.8')"
  fi
fi

# Telegram bot (optional)
BOT_TOKEN="${BOT_TOKEN:-}"
BOT_ADMINS="${BOT_ADMINS:-}"
if [[ -z "$BOT_TOKEN" ]]; then
  WANT_BOT="$(ask 'Enable Telegram management bot? (y/N)' 'n')"
  if [[ "$WANT_BOT" =~ ^[Yy] ]]; then
    BOT_TOKEN="$(ask 'BotFather token' '')"
    BOT_ADMINS="$(ask 'Admin numeric chat IDs (comma-separated)' '')"
  fi
fi

# ---------------------------------------------------------------- deps
info "Installing system dependencies…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq python3 python3-venv python3-pip curl unzip socat git ca-certificates >/dev/null
ok "Dependencies installed."

# ---------------------------------------------------------------- Xray-core
if ! command -v xray >/dev/null 2>&1; then
  info "Installing Xray-core…"
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null 2>&1 || \
    warn "Xray install script returned non-zero; continuing."
fi
command -v xray >/dev/null 2>&1 && ok "Xray-core: $(xray version 2>/dev/null | head -1)" || warn "Xray not detected; the panel installs but inbounds won't start until Xray is present."
mkdir -p "$(dirname "$XRAY_CONFIG")"

# ---------------------------------------------------------------- fetch panel
info "Fetching Vytrex Panel…"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
mkdir -p "$INSTALL_DIR"
export GIT_TERMINAL_PROMPT=0      # never prompt for a GitHub login
if [[ -d "$SELF_DIR/backend" && -d "$SELF_DIR/frontend" ]]; then
  cp -r "$SELF_DIR/." "$INSTALL_DIR/"           # running from a cloned repo
else
  rm -rf /tmp/vytrex-src && mkdir -p /tmp/vytrex-src
  TARBALL="https://codeload.github.com/${VYTREX_SLUG}/tar.gz/refs/heads/${VYTREX_BRANCH}"
  info "Downloading ${VYTREX_SLUG}@${VYTREX_BRANCH} (no login needed)…"
  if curl -fsSL "$TARBALL" | tar xz -C /tmp/vytrex-src --strip-components=1 2>/dev/null; then
    cp -r /tmp/vytrex-src/. "$INSTALL_DIR/"
  else
    warn "Tarball download failed; trying anonymous git clone…"
    if git clone --depth 1 -b "$VYTREX_BRANCH" "$VYTREX_REPO" /tmp/vytrex-git 2>/dev/null; then
      cp -r /tmp/vytrex-git/. "$INSTALL_DIR/"
    else
      err "Could not fetch the panel. Make sure the repo is PUBLIC:"
      err "  $VYTREX_REPO"
      exit 1
    fi
  fi
fi
ok "Panel files at $INSTALL_DIR"

# ---------------------------------------------------------------- python env
info "Creating Python environment…"
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
ok "Python environment ready."

# ---------------------------------------------------------------- SSL
CERT_FILE=""; KEY_FILE=""
if [[ "$SSL_MODE" == "1" && -n "$PANEL_DOMAIN" ]]; then
  info "Issuing a certificate for $PANEL_DOMAIN…"
  mkdir -p "$INSTALL_DIR/certs"
  ISSUED=0
  # free port 80 for the ACME challenge (temporarily)
  systemctl stop nginx apache2 >/dev/null 2>&1 || true
  # ---- 1) acme.sh (standalone) ----
  curl -s https://get.acme.sh | sh -s email="admin@$PANEL_DOMAIN" >/dev/null 2>&1 || true
  ACME="$HOME/.acme.sh/acme.sh"
  if [[ -x "$ACME" ]]; then
    "$ACME" --set-default-ca --server letsencrypt >/dev/null 2>&1 || true
    if "$ACME" --issue -d "$PANEL_DOMAIN" --standalone --keylength ec-256 >/dev/null 2>&1; then
      "$ACME" --install-cert -d "$PANEL_DOMAIN" --ecc \
        --fullchain-file "$INSTALL_DIR/certs/fullchain.pem" \
        --key-file "$INSTALL_DIR/certs/private.key" \
        --reloadcmd "systemctl restart vytrex-panel" >/dev/null 2>&1 && ISSUED=1
      [[ "$ISSUED" == "1" ]] && ok "Certificate issued via acme.sh."
    fi
  fi
  # ---- 2) certbot fallback ----
  if [[ "$ISSUED" == "0" ]]; then
    warn "acme.sh didn't succeed — trying certbot…"
    apt-get install -y -qq certbot >/dev/null 2>&1 || true
    if command -v certbot >/dev/null 2>&1 && \
       certbot certonly --standalone -d "$PANEL_DOMAIN" --non-interactive --agree-tos \
         -m "admin@$PANEL_DOMAIN" >/dev/null 2>&1; then
      ln -sf "/etc/letsencrypt/live/$PANEL_DOMAIN/fullchain.pem" "$INSTALL_DIR/certs/fullchain.pem"
      ln -sf "/etc/letsencrypt/live/$PANEL_DOMAIN/privkey.pem"  "$INSTALL_DIR/certs/private.key"
      ISSUED=1; ok "Certificate issued via certbot."
    fi
  fi
  if [[ "$ISSUED" == "1" ]]; then
    CERT_FILE="$INSTALL_DIR/certs/fullchain.pem"; KEY_FILE="$INSTALL_DIR/certs/private.key"
  else
    warn "Cert issuance failed — is the domain's A record pointed here and port 80 free?"
    warn "Continuing over plain HTTP; you can re-run install later once DNS is set."
  fi
elif [[ "$SSL_MODE" == "2" ]]; then
  info "Generating a self-signed certificate for the server IP…"
  mkdir -p "$INSTALL_DIR/certs"
  SRV_IP="$(curl -s https://api.ipify.org || echo 127.0.0.1)"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$INSTALL_DIR/certs/private.key" -out "$INSTALL_DIR/certs/fullchain.pem" \
    -subj "/CN=$SRV_IP" >/dev/null 2>&1 || apt-get install -y -qq openssl >/dev/null 2>&1
  if [[ -f "$INSTALL_DIR/certs/fullchain.pem" ]]; then
    CERT_FILE="$INSTALL_DIR/certs/fullchain.pem"; KEY_FILE="$INSTALL_DIR/certs/private.key"
    ok "Self-signed certificate generated (browsers will show a warning — this is expected)."
  fi
fi

# ---------------------------------------------------------------- use cert for panel?
# If a certificate was issued, ask whether to actually serve the panel over it.
if [[ -n "$CERT_FILE" ]]; then
  echo -e "${CYN}?${NC} ${GRN}Use this SSL certificate for the panel?${NC}"
  echo "     1) Yes — serve the panel over HTTPS"
  echo "     2) No  — keep the cert but serve HTTP"
  USE_SSL="$(ask 'Select' '1')"
  if [[ "$USE_SSL" == "2" ]]; then
    warn "Panel will run over plain HTTP; certificate kept in $INSTALL_DIR/certs."
    CERT_FILE=""; KEY_FILE=""
  fi
fi

# ---------------------------------------------------------------- config file
info "Writing configuration…"
SETUP_OUT="$("$INSTALL_DIR/venv/bin/python" "$INSTALL_DIR/backend/setup_cli.py" \
  --port "$PANEL_PORT" --user "$ADMIN_USER" --password "$ADMIN_PASS" \
  --domain "${PANEL_DOMAIN:-}" --cert "${CERT_FILE:-}" --key "${KEY_FILE:-}" \
  --path "${PANEL_PATH:-}" \
  --bot-token "${BOT_TOKEN:-}" --bot-admins "${BOT_ADMINS:-}")"
echo "$SETUP_OUT" | grep -v '^PANEL_PATH=' || true
# capture the (possibly auto-generated) secret path
PANEL_PATH="$(echo "$SETUP_OUT" | sed -n 's/^PANEL_PATH=//p' | head -1)"
# persist optional DNS setting
if [[ -n "${DNS_SERVERS:-}" ]]; then
  "$INSTALL_DIR/venv/bin/python" - "$DNS_SERVERS" <<'PYEOF'
import sys, os
sys.path.insert(0, os.path.join("/opt/vytrex-panel","backend"))
import db; db.set_setting("dns_servers", sys.argv[1])
PYEOF
fi
ok "Configuration saved."

# ---------------------------------------------------------------- vytrex menu
if [[ -f "$INSTALL_DIR/scripts/vytrex.sh" ]]; then
  install -m 755 "$INSTALL_DIR/scripts/vytrex.sh" /usr/local/bin/vytrex
  ok "Server menu installed — type 'vytrex' anytime."
fi

# ---------------------------------------------------------------- systemd
info "Installing systemd service…"
SSL_ARGS=""
[[ -n "$CERT_FILE" && -n "$KEY_FILE" ]] && SSL_ARGS="--ssl-certfile $CERT_FILE --ssl-keyfile $KEY_FILE"
cat >/etc/systemd/system/vytrex-panel.service <<EOF
[Unit]
Description=Vytrex Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port $PANEL_PORT $SSL_ARGS
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
# Telegram bot service (starts even without a token — it idles until one is set)
cat >/etc/systemd/system/vytrex-bot.service <<EOF
[Unit]
Description=Vytrex Panel — Telegram bot
After=network.target vytrex-panel.service

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/venv/bin/python bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now xray >/dev/null 2>&1 || true
systemctl enable --now vytrex-panel >/dev/null 2>&1
systemctl enable --now vytrex-bot >/dev/null 2>&1 || true
sleep 2
ok "Service started."

# ---------------------------------------------------------------- firewall
if command -v ufw >/dev/null 2>&1; then
  ufw allow "$PANEL_PORT"/tcp >/dev/null 2>&1 || true
  for p in 80 443; do ufw allow "$p"/tcp >/dev/null 2>&1 || true; done
fi

# ---------------------------------------------------------------- summary
IP="$(curl -s https://api.ipify.org || echo 'YOUR_SERVER_IP')"
SCHEME="http"; HOST="$IP"
if [[ -n "$CERT_FILE" ]]; then
  SCHEME="https"
  [[ -n "$PANEL_DOMAIN" ]] && HOST="$PANEL_DOMAIN" || HOST="$IP"
fi
echo
if [[ -n "$CERT_FILE" ]]; then SEC="🔒 HTTPS"; else SEC="HTTP (no SSL)"; fi
[[ -n "$PANEL_DOMAIN" ]] && ACCESS="domain: $PANEL_DOMAIN" || ACCESS="IP: $IP"
if [[ -n "$BOT_TOKEN" ]]; then TG="enabled — send /start to your bot"; else TG="off (add later in Settings)"; fi
URL="${SCHEME}://${HOST}:${PANEL_PORT}/${PANEL_PATH}"
echo -e "${GRN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                🚀  VYTREX PANEL IS READY                 ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
printf "   ${CYN}%-11s${NC} ${GRN}%s${NC}\n" "Panel URL"  "$URL"
printf "   ${CYN}%-11s${NC} %s\n" "Access"     "$ACCESS"
printf "   ${CYN}%-11s${NC} %s\n" "Port"       "$PANEL_PORT"
printf "   ${CYN}%-11s${NC} /%s\n" "Path"      "$PANEL_PATH"
printf "   ${CYN}%-11s${NC} %s\n" "Security"   "$SEC"
printf "   ${CYN}%-11s${NC} %s\n" "Username"   "$ADMIN_USER"
printf "   ${CYN}%-11s${NC} ${YLW}%s${NC}\n"   "Password"   "$ADMIN_PASS"
printf "   ${CYN}%-11s${NC} %s\n" "Telegram"   "$TG"
printf "   ${CYN}%-11s${NC} %s\n" "Menu"       "type 'vytrex' on the server"
echo -e "  ${GRN}────────────────────────────────────────────────────────────${NC}"
printf "   ${CYN}%-11s${NC} %s\n" "Panel"      "systemctl {status|restart|stop} vytrex-panel"
printf "   ${CYN}%-11s${NC} %s\n" "Bot"        "systemctl restart vytrex-bot · journalctl -u vytrex-bot -f"
printf "   ${CYN}%-11s${NC} %s\n" "Logs"       "journalctl -u vytrex-panel -f"
echo
echo -e "   ${YLW}⚠  Save the password above — it is shown only once.${NC}"
echo
