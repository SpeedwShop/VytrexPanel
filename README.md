# Vytrex Panel

A self-hosted **Xray management panel** for Ubuntu/Debian — inspired by the Sanaei (3x-ui) panel.
Multi-language (فارسی · English · العربية · Русский), black & white theme with animations, one-line install,
automatic SSL, live system monitor, and multi-protocol support.

🇮🇷 [راهنمای فارسی پایین صفحه](#راهنمای-فارسی)

---

## ✨ Features
- **One-line installer** — asks whether to use a **random or manual port** (default `2099`), admin username/password, and SSL mode.
- **Automatic SSL** — Let's Encrypt for a **domain** (via `acme.sh`) or a **self-signed** cert for a bare **IP**.
- **Live system monitor** — animated **CPU / RAM / Disk / Network / Uptime** gauges on the dashboard.
- **Xray protocols:** VLESS / VMess / Trojan over **TCP · WebSocket · gRPC · HTTP Upgrade · XHTTP**, with **TLS** or **Reality (xtls-rprx-vision)** — currently the strongest, lowest-detection transport available.
- **Inbounds · Outbounds · Routing** management (freedom/blackhole built-in, plus custom outbounds like WARP/WireGuard).
- **Professional clients:** auto-generated username (when left blank), **traffic quota**, **expiry date**, **per-user IP limit**, one-click **+Data** top-up, enable/disable, live usage from Xray stats.
- **Online status** — see who is connected right now and their IP count vs. limit.
- **Modern user page** (`/info/<token>`) — sleek animated page showing usage %, remaining data, days left, config links and QR.
- **Subscription** in v2ray/base64 (works with v2rayN, Hiddify, sing-box…).
- **Telegram bot** — admins manage from Telegram (server status, list/create/delete users, top-up data, who's online); customers self-serve (link with their subscription token, then check usage %, remaining data, days left and grab their configs). Runs as its own `vytrex-bot` service, no extra dependencies.
- **Nodes / multi-location** registry (agent-based sync — see roadmap).
- **WireGuard** & **OpenVPN** add-on modules.
- **4 languages + RTL**, black/white **dark & light** theme, entrance animations, welcome screen.
- SQLite database (zero-config), activity logs, PBKDF2 password hashing, signed session cookies.

## 🚀 Install (one line)
> Fork this repo, then set `VYTREX_REPO` in `install.sh` to your fork URL.
```bash
bash <(curl -Ls https://raw.githubusercontent.com/SpeedwShop/VytrexPanel/main/install.sh)
```
Or clone and run:
```bash
git clone https://github.com/SpeedwShop/VytrexPanel.git
cd vytrex-panel && sudo bash install.sh
```
The installer prints your panel URL and credentials at the end.

## 🔐 SSL options (asked during install)
1. **Let's Encrypt for a domain** — point the domain's `A` record to the server, keep port `80` free.
2. **Self-signed for the IP** — works instantly; browsers show a one-time warning.
3. **None** — plain HTTP.

## 🤖 Telegram bot
The installer asks whether to enable it, or add it later in **Settings → Telegram bot**
(paste a token from [@BotFather](https://t.me/BotFather) and your numeric admin chat IDs —
find yours via [@userinfobot](https://t.me/userinfobot)). The bot restarts automatically.

**Admin commands**
| Command | Action |
|---|---|
| `/start` `/status` | Server health: CPU/RAM/Disk/Uptime, Xray state, user counts |
| `/users` | List all clients with usage / quota / days left |
| `/find <email>` | Full details + config links for one client |
| `/adduser [gb] [days] [name]` | Create a client (name auto-generated if omitted) → returns sub link + config |
| `/deluser <email>` | Delete a client |
| `/adddata <email> <gb>` | Top-up a client's quota |
| `/online` | Who is connected right now, with IP counts |

**Customer (self-service) commands**
| Command | Action |
|---|---|
| `/start <token>` or `/link <token>` | Link this chat using the code after `/sub/` in their subscription URL |
| `/me` | Usage %, remaining data, days left, subscription link |
| `/config` | Their config links again |

Manage: `systemctl restart vytrex-bot` · logs: `journalctl -u vytrex-bot -f`

## 🧩 Add-on modules
```bash
sudo bash modules/wireguard.sh install      # WireGuard server (gaming/browsing)
sudo bash modules/wireguard.sh add phone     # add a peer (+QR)
sudo bash modules/openvpn.sh                 # OpenVPN (interactive)
```

## 🛠 Manage
```bash
systemctl {status|restart|stop} vytrex-panel
journalctl -u vytrex-panel -f
```

## 🔌 REST API (all under `/api/`, cookie-auth)
`login` · `state` · `system` · `online` · `inbounds` · `clients` (+`/quota`) · `outbounds` · `nodes` · `genkeys` · `settings` · `logs` · `reload`
Public: `/sub/<token>` (subscription) · `/info/<token>` (user page).

## 🗂 Structure
```
vytrex-panel/
├── install.sh                 # one-line installer
├── backend/  main.py db.py auth.py xray.py system.py bot.py config.py setup_cli.py requirements.txt
├── frontend/ index.html styles.css app.js info.html
├── modules/  wireguard.sh openvpn.sh
├── preview/  (offline UI demo)
├── systemd/  vytrex-panel.service vytrex-bot.service
└── version
```

## 🗺 Roadmap (next phases)
- ✅ **Telegram bot** (admin management + customer self-service) — shipped in v2.1.
- **Multi-node cluster:** a lightweight node-agent so one panel manages several servers/locations and pushes configs to them (the Nodes registry is already in place).
- In-panel WireGuard/OpenVPN management UI.

## 🔒 A note on security & filtering
**Reality (with `xtls-rprx-vision`)** is currently the state-of-the-art, hardest-to-detect transport — there isn't a meaningfully "stronger" widely-deployed option, so the panel makes Reality first-class. To lower blocking odds: use Reality with a reputable `dest`/SNI (e.g. microsoft/cloudflare), keep configs private, and use a **clean IP**. No tool can *guarantee* an IP/domain won't be filtered.

## 📜 License
MIT. Privacy / anti-censorship tooling — use it in compliance with your local laws.

---

<div dir="rtl">

## راهنمای فارسی

یک **پنل مدیریت Xray** برای نصب روی سرور مجازی Ubuntu/Debian — با الهام از پنل ثنایی (3x-ui).
چهار زبانه (فارسی · English · العربية · Русский)، تم سیاه و سفید با انیمیشن، نصب تک‌خطی، SSL خودکار،
مانیتور زندهٔ سیستم و پشتیبانی چندپروتکلی.

### ✨ امکانات
- **نصب تک‌خطی** — می‌پرسد پورت **رندوم** باشد یا **دستی** (پیش‌فرض `2099`)، یوزرنیم/پسورد ادمین، و نوع SSL.
- **SSL خودکار** — Let's Encrypt برای **دامنه** یا گواهی **self-signed** برای **IP**.
- **مانیتور زندهٔ سیستم** — گیج‌های انیمیشنی **CPU / RAM / دیسک / شبکه / آپتایم** در داشبورد.
- **پروتکل‌های Xray:** VLESS / VMess / Trojan روی **TCP · WebSocket · gRPC · HTTP Upgrade · XHTTP** با **TLS** یا **Reality (xtls-rprx-vision)** — قوی‌ترین و کم‌ردیاب‌ترین گزینهٔ فعلی.
- مدیریت **Inbound · Outbound · Routing** (direct/blackhole آماده + اوت‌باند سفارشی مثل WARP/WireGuard).
- **کاربر حرفه‌ای:** تولید **خودکار نام کاربری** (اگر خالی بگذاری)، **سهمیهٔ حجم**، **تاریخ انقضا**، **لیمیت IP** هر کاربر، دکمهٔ **+حجم**، فعال/غیرفعال، مصرف زنده از Xray.
- **وضعیت آنلاین** — ببین چه کسی همین حالا متصل است و چند IP دارد.
- **صفحهٔ مدرن کاربر** (`/info/<token>`) — نمایش درصد مصرف، حجم و زمان باقی‌مانده، لینک‌ها و QR.
- **ساب‌سکریپشن** v2ray/base64 (سازگار با v2rayN، Hiddify، sing-box).
- **ربات تلگرام** — ادمین از تلگرام مدیریت می‌کند (وضعیت سرور، لیست/ساخت/حذف کاربر، افزایش حجم، کاربران آنلاین) و مشتری با توکن اشتراک خود وارد می‌شود و مصرف، حجم و زمان باقی‌مانده و کانفیگ‌هایش را می‌بیند. سرویس جدا (`vytrex-bot`) بدون وابستگی اضافه.
- ثبت **نود / مولتی‌لوکیشن** (سینک agent-محور — در نقشهٔ راه).
- ماژول **WireGuard** و **OpenVPN**.
- **۴ زبان + RTL**، تم سیاه/سفید روشن و تاریک، انیمیشن، صفحهٔ خوش‌آمد.
- دیتابیس SQLite بدون‌دردسر، لاگ فعالیت، هش PBKDF2، کوکی نشست امضاشده.

### 🚀 نصب (تک‌خطی)
> اول مخزن را fork کن و `VYTREX_REPO` را داخل `install.sh` روی آدرس خودت بگذار.
```bash
bash <(curl -Ls https://raw.githubusercontent.com/SpeedwShop/VytrexPanel/main/install.sh)
```
یا:
```bash
git clone https://github.com/SpeedwShop/VytrexPanel.git
cd vytrex-panel && sudo bash install.sh
```

### 🔐 گزینه‌های SSL (هنگام نصب پرسیده می‌شود)
۱) Let's Encrypt برای **دامنه** (رکورد A به سرور، پورت ۸۰ آزاد) · ۲) **self-signed** برای **IP** (هشدار مرورگر) · ۳) بدون SSL.

### 🤖 ربات تلگرام
هنگام نصب پرسیده می‌شود، یا بعداً از **تنظیمات ← ربات تلگرام** توکن [@BotFather](https://t.me/BotFather)
و آیدی عددی ادمین‌ها ([@userinfobot](https://t.me/userinfobot)) را وارد کن. ربات خودکار ری‌استارت می‌شود.

**دستورات ادمین:** `/status` وضعیت سرور · `/users` لیست کاربران · `/find <email>` جزئیات ·
`/adduser [حجم‌GB] [روز] [نام]` ساخت کاربر (نام خالی = خودکار) · `/deluser <email>` حذف ·
`/adddata <email> <GB>` افزایش حجم · `/online` کاربران آنلاین.

**دستورات کاربر:** `/link <توکن>` اتصال با کد بعد از `/sub/` در لینک اشتراک · `/me` مصرف و زمان · `/config` کانفیگ‌ها.

مدیریت: `systemctl restart vytrex-bot` · لاگ: `journalctl -u vytrex-bot -f`

### 🧩 ماژول‌ها
```bash
sudo bash modules/wireguard.sh install
sudo bash modules/wireguard.sh add phone
sudo bash modules/openvpn.sh
```

### 🗺 نقشهٔ راه (فازهای بعد)
- ✅ **ربات تلگرام** (مدیریت ادمین + بخش کاربر) — در نسخهٔ ۲.۱ اضافه شد.
- **کلاستر مولتی‌نود:** agent سبک روی هر نود تا یک پنل چند سرور/لوکیشن را مدیریت کند (ثبت نود آماده است).
- مدیریت WireGuard/OpenVPN از داخل UI.

### 🔒 نکتهٔ امنیت و فیلترینگ
**Reality با `xtls-rprx-vision`** در حال حاضر قوی‌ترین و سخت‌ترین ترنسپورت برای شناسایی است؛ چیزی «خیلی قوی‌تر» و فراگیرتر از آن وجود ندارد، پس پنل Reality را در اولویت گذاشته. برای کاهش احتمال فیلتر: از `dest`/SNI معتبر (microsoft/cloudflare)، کانفیگ خصوصی و **IP تمیز** استفاده کن. هیچ ابزاری «تضمین» عدم فیلتر نمی‌دهد.

### 📜 مجوز
MIT — ابزار حریم خصوصی/ضدسانسور؛ مسئولیت استفادهٔ قانونی با کاربر.

</div>
