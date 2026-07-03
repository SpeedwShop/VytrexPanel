#!/usr/bin/env bash
# ==========================================================================
#  Vytrex — WireGuard add-on module (standalone, native wg-quick)
#  Sets up a WireGuard server and adds/removes peers with QR output.
#  Usage:
#    sudo bash wireguard.sh install            # set up server (interface wg0)
#    sudo bash wireguard.sh add <name>         # add a peer, print config + QR
#    sudo bash wireguard.sh remove <name>      # remove a peer
#    sudo bash wireguard.sh list               # list peers
# ==========================================================================
set -euo pipefail
WG_IF="wg0"
WG_DIR="/etc/wireguard"
WG_PORT="${WG_PORT:-51820}"
WG_NET="10.66.66"
CLIENT_DIR="$WG_DIR/clients"

[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
mkdir -p "$CLIENT_DIR"
pubip(){ curl -s https://api.ipify.org || echo "SERVER_IP"; }

install_wg(){
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq && apt-get install -y -qq wireguard qrencode iptables
  umask 077
  if [[ ! -f "$WG_DIR/server_private.key" ]]; then
    wg genkey | tee "$WG_DIR/server_private.key" | wg pubkey > "$WG_DIR/server_public.key"
  fi
  local priv; priv=$(cat "$WG_DIR/server_private.key")
  local nic; nic=$(ip route | awk '/default/{print $5; exit}')
  cat > "$WG_DIR/$WG_IF.conf" <<EOF
[Interface]
Address = ${WG_NET}.1/24
ListenPort = ${WG_PORT}
PrivateKey = ${priv}
PostUp   = iptables -t nat -A POSTROUTING -o ${nic} -j MASQUERADE; iptables -A FORWARD -i ${WG_IF} -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ${nic} -j MASQUERADE; iptables -D FORWARD -i ${WG_IF} -j ACCEPT
EOF
  sysctl -w net.ipv4.ip_forward=1 >/dev/null
  grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
  systemctl enable --now "wg-quick@$WG_IF"
  command -v ufw >/dev/null && ufw allow "$WG_PORT"/udp || true
  echo "[✓] WireGuard server ready on UDP ${WG_PORT}"
}

next_ip(){
  local used; used=$(grep -oE "${WG_NET}\.[0-9]+" "$WG_DIR/$WG_IF.conf" | grep -oE '[0-9]+$' | sort -n | tail -1)
  echo "${WG_NET}.$(( ${used:-1} + 1 ))"
}

add_peer(){
  local name="$1"; [[ -n "$name" ]] || { echo "name required"; exit 1; }
  umask 077
  local cpriv cpub psk ip srvpub
  cpriv=$(wg genkey); cpub=$(echo "$cpriv" | wg pubkey); psk=$(wg genpsk)
  ip=$(next_ip); srvpub=$(cat "$WG_DIR/server_public.key")
  cat >> "$WG_DIR/$WG_IF.conf" <<EOF

[Peer]
# ${name}
PublicKey = ${cpub}
PresharedKey = ${psk}
AllowedIPs = ${ip}/32
EOF
  local conf="$CLIENT_DIR/${name}.conf"
  cat > "$conf" <<EOF
[Interface]
PrivateKey = ${cpriv}
Address = ${ip}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${srvpub}
PresharedKey = ${psk}
Endpoint = $(pubip):${WG_PORT}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF
  systemctl restart "wg-quick@$WG_IF"
  echo "[✓] Peer '${name}' added -> ${conf}"; echo; cat "$conf"; echo
  command -v qrencode >/dev/null && qrencode -t ansiutf8 < "$conf"
}

list_peers(){ grep -E '^# ' "$WG_DIR/$WG_IF.conf" | sed 's/^# /- /' || echo "(none)"; }

remove_peer(){
  local name="$1"; local pub
  pub=$(awk -v n="# $name" '$0==n{getline; print $3}' "$WG_DIR/$WG_IF.conf")
  [[ -n "$pub" ]] && wg set "$WG_IF" peer "$pub" remove || true
  # strip block from config
  awk -v n="# $name" 'BEGIN{skip=0} /^\[Peer\]/{buf="[Peer]\n"; getline l; if(l==n){skip=1} else {printf "%s%s\n",buf,l; next}} {if(skip){if(/^\[Peer\]/){skip=0}else next} print}' "$WG_DIR/$WG_IF.conf" > "$WG_DIR/$WG_IF.conf.tmp" || true
  rm -f "$CLIENT_DIR/${name}.conf"
  echo "[✓] removed ${name} (verify $WG_DIR/$WG_IF.conf)"
}

case "${1:-}" in
  install) install_wg ;;
  add) add_peer "${2:-}" ;;
  remove) remove_peer "${2:-}" ;;
  list) list_peers ;;
  *) echo "usage: $0 {install|add <name>|remove <name>|list}"; exit 1 ;;
esac
