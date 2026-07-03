#!/usr/bin/env bash
# ==========================================================================
#  vytrex — server-side management menu for the Vytrex Panel
#  Installed to /usr/local/bin/vytrex by install.sh. Run:  vytrex
# ==========================================================================
set -uo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/vytrex-panel}"
PY="$INSTALL_DIR/venv/bin/python"
PANEL_SVC="vytrex-panel"
BOT_SVC="vytrex-bot"
VYTREX_SLUG="${VYTREX_SLUG:-SpeedwShop/VytrexPanel}"
VYTREX_BRANCH="${VYTREX_BRANCH:-main}"

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'
ok(){ echo -e "${G}[✓]${N} $*"; }
info(){ echo -e "${C}[*]${N} $*"; }
warn(){ echo -e "${Y}[!]${N} $*"; }
err(){ echo -e "${R}[x]${N} $*" >&2; }

[[ $EUID -eq 0 ]] || { err "Run as root:  sudo vytrex"; exit 1; }

# read one setting value out of the panel database
setting(){
  "$PY" - "$1" <<'PYEOF' 2>/dev/null
import sys, os
sys.path.insert(0, os.path.join(os.environ.get("INSTALL_DIR","/opt/vytrex-panel"),"backend"))
try:
    import db
    print(db.get_setting(sys.argv[1], "") or "")
except Exception:
    print("")
PYEOF
}

server_ip(){ curl -s https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'; }

panel_url(){
  local scheme=http host port path
  [[ -n "$(setting cert_file)" ]] && scheme=https || scheme=http
  host="$(setting server_addr)"; [[ -z "$host" ]] && host="$(server_ip)"
  port="$(setting panel_port)"; [[ -z "$port" ]] && port="2099"
  path="$(setting panel_path)"
  echo "${scheme}://${host}:${port}/${path}"
}

panel_info(){
  echo
  echo -e "  ${B}Vytrex Panel — info${N}"
  echo -e "  ${C}──────────────────────────────────────────────${N}"
  printf "   ${C}%-12s${N} %s\n" "URL"      "$(panel_url)"
  printf "   ${C}%-12s${N} %s\n" "Address"  "$(setting server_addr)"
  printf "   ${C}%-12s${N} %s\n" "Port"     "$(setting panel_port)"
  printf "   ${C}%-12s${N} %s\n" "Path"     "/$(setting panel_path)"
  printf "   ${C}%-12s${N} %s\n" "Username" "$(setting admin_user)"
  printf "   ${C}%-12s${N} %s\n" "Version"  "$(cat "$INSTALL_DIR/version" 2>/dev/null || echo '?')"
  local st; st="$(systemctl is-active $PANEL_SVC 2>/dev/null)"
  printf "   ${C}%-12s${N} %s\n" "Status"   "$st"
  echo -e "  ${C}──────────────────────────────────────────────${N}"
  echo -e "   ${Y}Password is only shown at install / after a reset.${N}"
}

panel_status(){
  echo
  systemctl status $PANEL_SVC --no-pager -l | head -12
  echo
  info "Xray: $(systemctl is-active xray 2>/dev/null)   ·   Bot: $(systemctl is-active $BOT_SVC 2>/dev/null)"
}

reset_creds(){
  echo
  read -rp "$(echo -e "${C}?${N} New username [keep current]: ")" NU
  read -rsp "$(echo -e "${C}?${N} New password [random if empty]: ")" NP; echo
  "$PY" - "$NU" "$NP" <<'PYEOF'
import sys, os
sys.path.insert(0, os.path.join(os.environ.get("INSTALL_DIR","/opt/vytrex-panel"),"backend"))
import secrets, db, auth
u = (sys.argv[1] or db.get_setting("admin_user") or "admin").strip()
p = sys.argv[2] or secrets.token_urlsafe(9)
auth.set_admin(u, p)
print("\nUsername: %s\nPassword: %s" % (u, p))
PYEOF
  ok "Credentials updated."
}

update_panel(){
  info "Fetching latest Vytrex Panel (${VYTREX_SLUG}@${VYTREX_BRANCH})…"
  local tmp; tmp="$(mktemp -d)"
  local tarball="https://codeload.github.com/${VYTREX_SLUG}/tar.gz/refs/heads/${VYTREX_BRANCH}"
  if ! curl -fsSL "$tarball" | tar xz -C "$tmp" --strip-components=1 2>/dev/null; then
    err "Download failed — check your internet / repo name."; rm -rf "$tmp"; return 1
  fi
  # keep user data & certs; replace code
  info "Applying update (data & certs are preserved)…"
  for d in backend frontend modules scripts systemd install.sh version README.md; do
    [[ -e "$tmp/$d" ]] && cp -rf "$tmp/$d" "$INSTALL_DIR/"
  done
  rm -rf "$tmp"
  "$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/backend/requirements.txt" 2>/dev/null || true
  # refresh the menu itself
  [[ -f "$INSTALL_DIR/scripts/vytrex.sh" ]] && install -m755 "$INSTALL_DIR/scripts/vytrex.sh" /usr/local/bin/vytrex
  systemctl restart $PANEL_SVC
  systemctl restart $BOT_SVC 2>/dev/null || true
  ok "Updated to v$(cat "$INSTALL_DIR/version" 2>/dev/null). Panel restarted."
}

uninstall_panel(){
  echo
  warn "This will REMOVE the panel, its services and ALL data."
  read -rp "$(echo -e "${R}Type 'DELETE' to confirm: ${N}")" cf
  [[ "$cf" == "DELETE" ]] || { info "Cancelled."; return; }
  systemctl disable --now $PANEL_SVC $BOT_SVC 2>/dev/null || true
  rm -f /etc/systemd/system/$PANEL_SVC.service /etc/systemd/system/$BOT_SVC.service
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  rm -f /usr/local/bin/vytrex
  ok "Vytrex Panel removed. (Xray-core was left installed.)"
  exit 0
}

menu(){
  clear
  echo -e "${G}"
  echo "   ╦  ╦╦ ╦╔╦╗╦═╗╔═╗═╗ ╦"
  echo "   ╚╗╔╝╚╦╝ ║ ╠╦╝║╣ ╔╩╦╝"
  echo "    ╚╝  ╩  ╩ ╩╚═╚═╝╩ ╚═"
  echo -e "${N}   Vytrex Panel manager · v$(cat "$INSTALL_DIR/version" 2>/dev/null || echo '?')"
  echo
  echo -e "   ${B}گزینه ۱)${N}  استارت پنل        ${C}(start)${N}"
  echo -e "   ${B}گزینه ۲)${N}  ری‌استارت پنل     ${C}(restart)${N}"
  echo -e "   ${B}گزینه ۳)${N}  متوقف کردن پنل    ${C}(stop)${N}"
  echo -e "   ${B}گزینه ۴)${N}  وضعیت پنل         ${C}(status)${N}"
  echo -e "   ${B}گزینه ۵)${N}  آپدیت پنل         ${C}(update)${N}"
  echo -e "   ${B}گزینه ۶)${N}  ریست نام کاربری و رمز عبور"
  echo -e "   ${B}گزینه ۷)${N}  اطلاعات پنل       ${C}(info)${N}"
  echo -e "   ${B}گزینه ۸)${N}  ری‌استارت ربات تلگرام"
  echo -e "   ${B}گزینه ۹)${N}  حذف کامل پنل      ${C}(uninstall)${N}"
  echo -e "   ${B}گزینه ۰)${N}  خروج"
  echo
  read -rp "$(echo -e "${C}?${N} انتخاب شما: ")" ch
  case "$ch" in
    1) systemctl start $PANEL_SVC && ok "Panel started." ;;
    2) systemctl restart $PANEL_SVC && ok "Panel restarted." ;;
    3) systemctl stop $PANEL_SVC && ok "Panel stopped." ;;
    4) panel_status ;;
    5) update_panel ;;
    6) reset_creds ;;
    7) panel_info ;;
    8) systemctl restart $BOT_SVC && ok "Bot restarted." ;;
    9) uninstall_panel ;;
    0) exit 0 ;;
    *) warn "گزینه نامعتبر." ;;
  esac
  echo; read -rp "$(echo -e "${C}Enter برای بازگشت به منو…${N}")" _
}

export INSTALL_DIR
while true; do menu; done
