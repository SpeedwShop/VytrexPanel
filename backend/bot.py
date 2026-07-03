"""
Vytrex Panel — Telegram bot (stdlib only, long-polling).

Runs as its own systemd service (`vytrex-bot`) next to the panel and talks to the
SAME SQLite database, so no extra dependencies and no HTTP hop are needed.

Configuration lives in the panel settings table (set from the panel Settings tab
or by the installer):
    bot_token   : the BotFather token   (empty -> bot idles, does nothing)
    bot_admins  : comma-separated Telegram numeric chat IDs allowed to manage

ADMIN commands
    /start /help            show the admin menu
    /status                 server health (CPU/RAM/Disk/Uptime, Xray, counts)
    /users                  list clients with usage / quota / expiry
    /find <email>           full details + sub link for one client
    /adduser [gb] [days] [name]   create a client on the first inbound
    /deluser <email>        delete a client
    /adddata <email> <gb>   top-up a client's quota
    /online                 who is connected right now (+ IP counts)

USER (self-service) commands — for people who bought a service
    /start <sub_token>      link this chat to a subscription (also: /link <token>)
    /me                     show my usage %, remaining data, days left, sub link
    /config                 show my config links again
"""
import os
import sys
import time
import json
import html
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db          # noqa: E402
import xray        # noqa: E402
import system      # noqa: E402
from config import VERSION  # noqa: E402

API = "https://api.telegram.org/bot{token}/{method}"
POLL_TIMEOUT = 50


# ───────────────────────────── low-level Telegram ─────────────────────────────
def _token():
    return (db.get_setting("bot_token", "") or "").strip()


def _admins():
    raw = db.get_setting("bot_admins", "") or ""
    out = set()
    for part in raw.replace(" ", "").split(","):
        if part.lstrip("-").isdigit():
            out.add(int(part))
    return out


def _call(method, **params):
    token = _token()
    if not token:
        return None
    url = API.format(token=token, method=method)
    data = urllib.parse.urlencode(
        {k: (json.dumps(v) if isinstance(v, (dict, list)) else v)
         for k, v in params.items() if v is not None}
    ).encode()
    try:
        with urllib.request.urlopen(url, data=data, timeout=POLL_TIMEOUT + 15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print("[bot] telegram call failed:", method, e, flush=True)
        return None


def send(chat_id, text, keyboard=None):
    params = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
              "disable_web_page_preview": True}
    if keyboard:
        params["reply_markup"] = {"keyboard": keyboard, "resize_keyboard": True}
    return _call("sendMessage", **params)


def get_updates(offset):
    token = _token()
    if not token:
        return []
    url = API.format(token=token, method="getUpdates")
    data = urllib.parse.urlencode({"timeout": POLL_TIMEOUT, "offset": offset}).encode()
    try:
        with urllib.request.urlopen(url, data=data, timeout=POLL_TIMEOUT + 15) as r:
            payload = json.loads(r.read().decode())
        return payload.get("result", []) if payload.get("ok") else []
    except Exception:
        return []


# ───────────────────────────── formatting helpers ─────────────────────────────
def fmt_bytes(n):
    n = float(n or 0)
    for u in ["B", "KB", "MB", "GB", "TB"]:
        if n < 1024 or u == "TB":
            return (f"{int(n)} {u}" if u in ("B", "KB") else f"{n:.2f} {u}")
        n /= 1024


def fmt_uptime(sec):
    sec = int(sec or 0)
    d, sec = divmod(sec, 86400)
    h, sec = divmod(sec, 3600)
    m = sec // 60
    return (f"{d}d " if d else "") + f"{h}h {m}m"


def days_left(expiry):
    if not expiry:
        return None
    try:
        left = (time.mktime(time.strptime(expiry[:10], "%Y-%m-%d")) - time.time()) / 86400
        return max(0, int(left))
    except Exception:
        return None


def base_url():
    scheme = "https" if db.get_setting("cert_file") else "http"
    addr = db.get_setting("server_addr", "") or "YOUR_SERVER"
    port = db.get_setting("panel_port", "2099")
    return f"{scheme}://{addr}:{port}"


def sub_url(c):
    return f"{base_url()}/sub/{c['sub_token']}"


def client_summary(c):
    used = int(c["used_bytes"] or 0)
    quota = int(c["quota_bytes"] or 0)
    pct = (min(100, round(used / quota * 100)) if quota else 0)
    remain = fmt_bytes(max(0, quota - used)) if quota else "∞"
    dl = days_left(c.get("expiry"))
    status = "🟢 Active" if c["enabled"] else "🔴 Disabled"
    hold_text = f" (On Hold: {c.get('total_days', 0)} days)" if int(c.get("on_hold") or 0) else ""
    lines = [
        f"👤 <b>{html.escape(c['email'])}</b>  {status}{hold_text}",
        f"📊 Used: <b>{fmt_bytes(used)}</b> / {fmt_bytes(quota) if quota else '∞'}  ({pct}%)",
        f"📦 Remaining: <b>{remain}</b>",
        f"⏳ Days left: <b>{dl if dl is not None else '∞'}</b>",
        f"🔗 Sub: {sub_url(c)}",
    ]
    return "\n".join(lines)


ADMIN_KB = [["/status", "/users", "/online"],
            ["/adduser", "/adddata", "/deluser"]]
USER_KB = [["/me", "/config"]]


# ───────────────────────────── admin command logic ─────────────────────────────
def h_status(chat_id):
    snap = system.snapshot()
    clients = db.list_clients()
    active = sum(1 for c in clients if c["enabled"])
    inbounds = db.list_inbounds()
    txt = (
        f"🖥 <b>Vytrex Server</b> v{VERSION}\n\n"
        f"⚙️ CPU: <b>{snap['cpu']}%</b>  ·  cores: {snap['cores']}\n"
        f"🧠 RAM: <b>{snap['mem']['percent']}%</b> "
        f"({fmt_bytes(snap['mem']['used'])}/{fmt_bytes(snap['mem']['total'])})\n"
        f"💽 Disk: <b>{snap['disk']['percent']}%</b> "
        f"({fmt_bytes(snap['disk']['used'])}/{fmt_bytes(snap['disk']['total'])})\n"
        f"⏱ Uptime: <b>{fmt_uptime(snap['uptime'])}</b>\n"
        f"📶 Net: ↓{fmt_bytes(snap['net']['rx'])}/s  ↑{fmt_bytes(snap['net']['tx'])}/s\n\n"
        f"🚀 Xray: <b>{'running' if xray.xray_running() else 'stopped'}</b>\n"
        f"📥 Inbounds: <b>{len(inbounds)}</b>\n"
        f"👥 Clients: <b>{active}</b> active / {len(clients)} total"
    )
    send(chat_id, txt, ADMIN_KB)


def h_users(chat_id):
    try:
        xray.fetch_stats()
    except Exception:
        pass
    clients = db.list_clients()
    if not clients:
        send(chat_id, "No clients yet. Use /adduser to create one.", ADMIN_KB)
        return
    chunk = f"👥 <b>Clients ({len(clients)})</b>\n\n"
    for c in clients:
        used = int(c["used_bytes"] or 0)
        quota = int(c["quota_bytes"] or 0)
        dl = days_left(c.get("expiry"))
        mark = "🟢" if c["enabled"] else "🔴"
        chunk += (f"{mark} <b>{html.escape(c['email'])}</b> — "
                  f"{fmt_bytes(used)}/{fmt_bytes(quota) if quota else '∞'}"
                  f" · {dl if dl is not None else '∞'}d\n")
        if len(chunk) > 3500:
            send(chat_id, chunk); chunk = ""
    if chunk:
        send(chat_id, chunk, ADMIN_KB)


def _find_client(email):
    for c in db.list_clients():
        if c["email"].lower() == email.lower():
            return c
    return None


def h_find(chat_id, args):
    if not args:
        send(chat_id, "Usage: /find <email>", ADMIN_KB); return
    c = _find_client(args[0])
    if not c:
        send(chat_id, f"Not found: {html.escape(args[0])}", ADMIN_KB); return
    txt = client_summary(c) + "\n\n<b>Configs:</b>\n"
    for l in xray.client_links(c):
        txt += f"<code>{html.escape(l)}</code>\n"
    send(chat_id, txt, ADMIN_KB)


def h_adduser(chat_id, args):
    """/adduser [gb] [days] [name]"""
    inbounds = db.list_inbounds()
    if not inbounds:
        send(chat_id, "❌ Create an inbound in the panel first.", ADMIN_KB); return
    gb = float(args[0]) if len(args) >= 1 and _isnum(args[0]) else 0
    days = int(args[1]) if len(args) >= 2 and args[1].isdigit() else 0
    name = args[2] if len(args) >= 3 else ""
    import uuid, secrets, random
    adj = ["swift", "silent", "cobalt", "lunar", "amber", "nova", "delta", "onyx"]
    noun = ["falcon", "otter", "cedar", "quartz", "raven", "comet", "willow", "lynx"]
    if not name:
        name = f"{random.choice(adj)}-{random.choice(noun)}-{secrets.token_hex(2)}"
    expiry = ""
    if days:
        expiry = time.strftime("%Y-%m-%d", time.localtime(time.time() + days * 86400))
    cid = db.upsert_client({
        "inbound_id": inbounds[0]["id"], "email": name, "secret": str(uuid.uuid4()),
        "quota_bytes": int(gb * 1073741824), "expiry": expiry, "enabled": True,
    })
    ok, _ = xray.write_and_reload()
    db.add_log("bot", f"adduser {name} ({gb}GB/{days}d) reload={ok}", f"tg:{chat_id}")
    c = db.get_client(cid)
    send(chat_id, "✅ <b>Client created</b>\n\n" + client_summary(c) +
         "\n\n<b>Config:</b>\n" +
         "\n".join(f"<code>{html.escape(l)}</code>" for l in xray.client_links(c)),
         ADMIN_KB)


def h_deluser(chat_id, args):
    if not args:
        send(chat_id, "Usage: /deluser <email>", ADMIN_KB); return
    c = _find_client(args[0])
    if not c:
        send(chat_id, f"Not found: {html.escape(args[0])}", ADMIN_KB); return
    db.delete_client(c["id"])
    ok, _ = xray.write_and_reload()
    db.add_log("bot", f"deluser {c['email']} reload={ok}", f"tg:{chat_id}")
    send(chat_id, f"🗑 Deleted <b>{html.escape(c['email'])}</b>", ADMIN_KB)


def h_adddata(chat_id, args):
    if len(args) < 2 or not _isnum(args[1]):
        send(chat_id, "Usage: /adddata <email> <gb>", ADMIN_KB); return
    c = _find_client(args[0])
    if not c:
        send(chat_id, f"Not found: {html.escape(args[0])}", ADMIN_KB); return
    db.adjust_client_quota(c["id"], int(float(args[1]) * 1073741824))
    db.add_log("bot", f"adddata {c['email']} +{args[1]}GB", f"tg:{chat_id}")
    send(chat_id, f"✅ Added <b>{args[1]} GB</b> to {html.escape(c['email'])}",
         ADMIN_KB)


def h_online(chat_id):
    om = xray.online_map()
    if not om:
        send(chat_id, "No one online in the last 2 minutes.", ADMIN_KB); return
    txt = "🟢 <b>Online now</b>\n\n"
    for email, ips in om.items():
        txt += f"• <b>{html.escape(email)}</b> — {len(ips)} IP\n  {', '.join(ips)}\n"
    send(chat_id, txt, ADMIN_KB)


# ───────────────────────────── user self-service logic ─────────────────────────
def h_link(chat_id, token):
    c = db.get_client_by_token(token)
    if not c:
        send(chat_id, "❌ Invalid token. Ask your provider for your subscription link "
                      "and send the code after /sub/.", USER_KB)
        return
    db.set_setting(f"tgbind:{chat_id}", c["sub_token"])
    send(chat_id, "✅ Linked!\n\n" + client_summary(c), USER_KB)


def _my_client(chat_id):
    tok = db.get_setting(f"tgbind:{chat_id}")
    return db.get_client_by_token(tok) if tok else None


def h_me(chat_id):
    c = _my_client(chat_id)
    if not c:
        send(chat_id, "You're not linked yet. Send:\n<code>/link YOUR_SUB_TOKEN</code>",
             USER_KB)
        return
    try:
        xray.fetch_stats()
    except Exception:
        pass
    c = db.get_client_by_token(c["sub_token"])
    send(chat_id, client_summary(c), USER_KB)


def h_config(chat_id):
    c = _my_client(chat_id)
    if not c:
        send(chat_id, "You're not linked yet. Send: <code>/link YOUR_SUB_TOKEN</code>",
             USER_KB)
        return
    txt = f"🔗 <b>{html.escape(c['email'])}</b> configs:\n\n"
    for l in xray.client_links(c):
        txt += f"<code>{html.escape(l)}</code>\n\n"
    txt += f"Subscription: {sub_url(c)}"
    send(chat_id, txt, USER_KB)


def _isnum(s):
    try:
        float(s); return True
    except Exception:
        return False


# ───────────────────────────── router ─────────────────────────────
def handle(update):
    msg = update.get("message") or update.get("edited_message")
    if not msg or "text" not in msg:
        return
    chat_id = msg["chat"]["id"]
    text = msg["text"].strip()
    parts = text.split()
    cmd = parts[0].lower().lstrip("/").split("@")[0]
    args = parts[1:]
    is_admin = chat_id in _admins()

    # user self-service (available to everyone)
    if cmd == "start":
        if args:                      # deep-link token: t.me/bot?start=TOKEN
            h_link(chat_id, args[0]); return
        if is_admin:
            send(chat_id, "👑 <b>Vytrex Admin</b>\nPick an action:", ADMIN_KB)
        else:
            send(chat_id, "👋 <b>Welcome to Vytrex</b>\n\nSend your subscription code:\n"
                          "<code>/link YOUR_SUB_TOKEN</code>\nThen use /me and /config.",
                 USER_KB)
        return
    if cmd == "link":
        h_link(chat_id, args[0] if args else ""); return
    if cmd == "me":
        h_me(chat_id); return
    if cmd == "config":
        h_config(chat_id); return

    # admin-only
    if cmd in ("help", "status", "users", "find", "adduser", "deluser",
               "adddata", "online"):
        if not is_admin:
            send(chat_id, "⛔️ Admins only. Use /link to access your own service.",
                 USER_KB)
            return
        if cmd in ("help", "status"):
            h_status(chat_id)
        elif cmd == "users":
            h_users(chat_id)
        elif cmd == "find":
            h_find(chat_id, args)
        elif cmd == "adduser":
            h_adduser(chat_id, args)
        elif cmd == "deluser":
            h_deluser(chat_id, args)
        elif cmd == "adddata":
            h_adddata(chat_id, args)
        elif cmd == "online":
            h_online(chat_id)
        return

    # fallback
    if is_admin:
        send(chat_id, "Unknown command. Try /status /users /adduser.", ADMIN_KB)
    else:
        send(chat_id, "Send /link YOUR_SUB_TOKEN or /me.", USER_KB)


def run():
    db.init_db()
    print(f"[bot] Vytrex bot v{VERSION} started", flush=True)
    offset = 0
    while True:
        if not _token():                     # no token configured yet -> idle
            time.sleep(10)
            continue
        for upd in get_updates(offset):
            offset = upd["update_id"] + 1
            try:
                handle(upd)
            except Exception as e:
                print("[bot] handler error:", e, flush=True)


if __name__ == "__main__":
    run()
