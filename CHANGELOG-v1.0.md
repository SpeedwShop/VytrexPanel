# Vytrex Panel — v1.0.0

This release focuses on the bugs and requests you reported.

## 🔴 Critical fix — inbounds/clients now connect
- **VLESS share links were missing `encryption=none`**, which clients like v2rayN/NG,
  Hiddify and sing-box require. Without it the imported config is silently rejected and
  never connects to the server. It is now always included. (`backend/xray.py`)
- VMess links now include `scy: auto` for wider client compatibility.
- A simple VLESS-over-TCP inbound + a new client now produce a valid, importable link
  that connects. (verified)

## 🧭 Navigation — side menu with animated dropdowns
- The top tab bar was replaced by a **vertical side menu** placed on the **inline-start**
  edge — i.e. the **right** side in Persian/RTL and the **left** side in English/LTR
  (this satisfies both of your notes at once and stays correct in every language).
- Grouped, **animated dropdown submenus**: **Network** (Outbounds · Routing · Nodes) and
  **Settings** (with its sub-sections). Opening/closing is smooth-animated.
- On mobile the sidebar becomes an off-canvas drawer opened by the ☰ button, with a
  dimmed backdrop and a close (✕) button.

## ⚙️ Settings — everything editable from the panel (no SSH)
Reorganised into animated sections that match what you asked for:
- **General** — server address, panel port, secret path, listen IP/domain, session
  duration, pagination size, trusted proxy CIDRs, panel outbound, DNS, subscription domain/port.
- **Authentication**
  - **Admin credentials** — change username/password instantly from the panel.
  - **Two-factor authentication (2FA)** — real TOTP (Google Authenticator etc.):
    Enable → scan QR → confirm code. Login then asks for the 6-digit code.
  - **API Token** — generate/copy/revoke; use header `X-API-Token` for automation.
- **Certificates** — public/private key paths (applied to Xray live).
- **Date & Time** — timezone + **Calendar type with Jalali/Shamsi (شمسی)** option
  (user pages show Shamsi dates when selected).
- **Notifications** — expiry-day and traffic-cap thresholds.
- **External Traffic** — enable + report URL.
- **LDAP** — full LDAP sync configuration.
- **Telegram Bot** and **Backup & Restore** (kept from before).

## 🌐 Language / fonts
- **Default language is now English** everywhere: the installer prompts are English-only,
  the panel and the login page default to English, and `index.html`/DB default to `en`.
- Persian still fully available from the language switcher, with **RTL polish**: numerals
  are kept Latin & tabular (precise digits), action buttons no longer overlap labels,
  selects reserve space for the arrow, long labels wrap instead of colliding.

## ➕ Inbound form
- Added an **Inbound listen (IP)** field (now editable on both create and edit).

## 🏷️ Version
- Panel version is now **1.0.0** (`version`, `backend/config.py`, UI label).

---
### Notes / still on the roadmap
- The Add-Inbound form covers the common Xray options (protocol, network, TLS/Reality,
  Reality key generation, Shadowsocks, listen). The full 3x-ui "every advanced field"
  set (per-tab uTLS/ALPN/ECH/OCSP, TCP masks, raw JSON editors, per-client Total Flow /
  Traffic Reset / Duration) is a large surface and can be expanded in a follow-up.
- 2FA, API token, LDAP, notifications and external-traffic settings are **stored and wired**;
  the LDAP sync worker and notification dispatch use your existing bot/schedule plumbing.
- If you change the **panel port** or restore a backup, restart once:
  `systemctl restart vytrex-panel`.
