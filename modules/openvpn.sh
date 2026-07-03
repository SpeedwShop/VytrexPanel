#!/usr/bin/env bash
# ==========================================================================
#  Vytrex — OpenVPN add-on module
#
#  OpenVPN has a completely different architecture from Xray, so it runs as
#  its own service rather than through the panel. This wrapper uses the
#  well-known, battle-tested community installer (Nyr/openvpn-install),
#  which handles PKI, certs, firewall and client .ovpn generation.
#
#  Usage:  sudo bash openvpn.sh
#  Then follow the interactive prompts. Re-run it later to add/revoke users.
# ==========================================================================
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }

echo "[*] Launching the OpenVPN road-warrior installer…"
echo "    (installs OpenVPN, sets up PKI, and generates client .ovpn files)"
curl -fsSL https://raw.githubusercontent.com/Nyr/openvpn-install/master/openvpn-install.sh -o /tmp/openvpn-install.sh
bash /tmp/openvpn-install.sh
