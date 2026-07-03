"""Vytrex Panel — FastAPI application."""
import os, json, uuid, secrets, time, shutil
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles

import db, auth, xray, system
from config import FRONTEND_DIR, VERSION, DB_PATH, BACKUP_DIR

db.init_db()
app = FastAPI(title="Vytrex Panel", version=VERSION)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

COOKIE = "vytrex_session"


def is_authed(request: Request) -> bool:
    # session cookie OR a valid API token header (X-API-Token) for automation
    if auth.verify_session(request.cookies.get(COOKIE, "")):
        return True
    tok = request.headers.get("x-api-token", "")
    return auth.verify_api_token(tok)


def need_auth(request: Request):
    if not is_authed(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return None


def client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "")


def sub_base() -> str:
    """Base URL used for subscription / info links.
    Honors optional sub_domain / sub_port overrides (for a reverse proxy setup),
    otherwise falls back to the panel's own address and port."""
    scheme = "https" if db.get_setting("cert_file") else "http"
    addr = db.get_setting("sub_domain", "") or db.get_setting("server_addr", "") or ""
    port = db.get_setting("sub_port", "") or db.get_setting("panel_port", "2099")
    host = f"{addr}:{port}" if port else addr
    return f"{scheme}://{host}"


# ─────────────────────────────── pages ────────────────────────────────
RESERVED = {"api", "static", "sub", "info", "dash", "health", "favicon.ico", "robots.txt"}


def _serve_index():
    path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(path):
        return FileResponse(path)
    return HTMLResponse("<h1>Vytrex Panel</h1><p>frontend missing</p>")


def _not_found():
    # generic 404 so a bare IP:port scan reveals nothing about the panel
    return HTMLResponse("<html><head><title>404 Not Found</title></head>"
                        "<body><center><h1>404 Not Found</h1></center><hr><center>nginx</center>"
                        "</body></html>", status_code=404)


@app.get("/", response_class=HTMLResponse)
def index():
    # When a secret panel path is set, the bare root must NOT reveal the panel.
    if db.get_setting("panel_path", ""):
        return _not_found()
    return _serve_index()


# ─────────────────────────────── auth ─────────────────────────────────
@app.post("/api/login")
async def login(request: Request):
    body = await request.json()
    if auth.verify_login(body.get("username", ""), body.get("password", "")):
        # second factor (TOTP) if enabled
        if db.get_setting("twofa_enabled") == "1" and db.get_setting("twofa_secret"):
            otp = str(body.get("otp", "")).strip()
            if not otp:
                return JSONResponse({"error": "otp required", "twofa": True}, status_code=401)
            if not auth.verify_totp(db.get_setting("twofa_secret"), otp):
                db.add_log("login", "2fa failed", client_ip(request))
                return JSONResponse({"error": "invalid 2FA code", "twofa": True}, status_code=401)
        resp = JSONResponse({"ok": True})
        resp.set_cookie(COOKIE, auth.make_session(), httponly=True, samesite="lax",
                        secure=bool(db.get_setting("cert_file")), max_age=43200, path="/")
        db.add_log("login", "success", client_ip(request))
        return resp
    db.add_log("login", "failed", client_ip(request))
    return JSONResponse({"error": "invalid credentials"}, status_code=401)


@app.post("/api/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE, path="/")
    return resp


# ─────────────────────────────── state ────────────────────────────────
@app.get("/api/state")
def state(request: Request):
    if (r := need_auth(request)):
        return r
    try:
        xray.fetch_stats()
    except Exception:
        pass
    # auto-disable over-quota / expired clients and activate on-hold ones
    try:
        if xray.enforce_quotas_and_expiry():
            xray.write_and_reload()
    except Exception:
        pass
    settings = db.all_settings()
    for k in ("admin_hash", "admin_salt", "secret_key", "twofa_secret", "ldap_password"):
        settings.pop(k, None)
    # expose booleans for sensitive-but-relevant flags without leaking values
    settings["twofa_configured"] = "1" if db.get_setting("twofa_secret") else ""
    settings["ldap_password_set"] = "1" if db.get_setting("ldap_password") else ""
    settings["admin_user"] = db.get_setting("admin_user", "admin")
    # never leak the bot token to the browser; expose a boolean instead
    settings["bot_configured"] = "1" if settings.get("bot_token") else ""
    settings.pop("bot_token", None)
    for k in [k for k in settings if k.startswith("tgbind:")]:
        settings.pop(k, None)
    inbounds = db.list_inbounds()
    for inb in inbounds:
        inb["settings"] = json.loads(inb.get("settings") or "{}")
        inb["stream"] = json.loads(inb.get("stream") or "{}")
        inb["clients"] = db.list_clients(inb["id"])
    clients = db.list_clients()
    total = sum(int(c["used_bytes"] or 0) for c in clients)
    return {
        "version": VERSION,
        "settings": settings,
        "inbounds": inbounds,
        "outbounds": db.list_outbounds(),
        "routing": db.list_routing(),
        "nodes": db.list_nodes(),
        "stats": {
            "inbounds": len(inbounds),
            "clients": len(clients),
            "total_traffic": total,
            "xray_running": xray.xray_running(),
        },
    }


# ─────────────────────────────── inbounds ─────────────────────────────
@app.get("/api/inbounds")
def get_inbounds(request: Request):
    if (r := need_auth(request)):
        return r
    return {"inbounds": db.list_inbounds()}


@app.post("/api/inbounds")
async def save_inbound(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    b.setdefault("tag", "in-" + secrets.token_hex(3))
    # auto-generate reality keys if requested and missing
    if b.get("security") == "reality":
        stream = b.get("stream", {})
        if not stream.get("privateKey"):
            priv, pub = xray.gen_x25519()
            stream["privateKey"], stream["publicKey"] = priv, pub
        if not stream.get("shortIds"):
            stream["shortIds"] = [secrets.token_hex(4)]
        b["stream"] = stream
    if b.get("id"):
        db.update_inbound(int(b["id"]), b)
        iid = int(b["id"])
    else:
        iid = db.create_inbound(b)
    ok, err = xray.write_and_reload()
    db.add_log("inbound", f"saved {b.get('tag')} reload={ok}", client_ip(request))
    return {"ok": True, "id": iid, "reload": ok, "error": err}


@app.delete("/api/inbounds/{iid}")
def del_inbound(iid: int, request: Request):
    if (r := need_auth(request)):
        return r
    db.delete_inbound(iid)
    ok, err = xray.write_and_reload()
    db.add_log("inbound", f"deleted {iid}", client_ip(request))
    return {"ok": True, "reload": ok}


# ─────────────────────────────── clients ──────────────────────────────
_ADJ = ["swift", "silent", "cobalt", "lunar", "amber", "nova", "delta", "onyx", "vivid", "zephyr"]
_NOUN = ["falcon", "otter", "cedar", "quartz", "raven", "comet", "willow", "lynx", "harbor", "ember"]

def gen_username():
    import random
    for _ in range(20):
        name = f"{random.choice(_ADJ)}-{random.choice(_NOUN)}-{secrets.token_hex(2)}"
        if not any(c["email"] == name for c in db.list_clients()):
            return name
    return "user-" + secrets.token_hex(4)


@app.post("/api/clients")
async def save_client(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    inb = db.get_inbound(int(b["inbound_id"]))
    if not inb:
        return JSONResponse({"error": "inbound not found"}, status_code=404)
    if not b.get("email"):
        b["email"] = gen_username()          # auto-generate a username
    if not b.get("secret"):
        b["secret"] = str(uuid.uuid4())      # uuid for vless/vmess; usable as trojan password
    cid = db.upsert_client(b)
    ok, err = xray.write_and_reload()
    db.add_log("client", f"saved {b.get('email')} reload={ok}", client_ip(request))
    return {"ok": True, "id": cid, "email": b["email"], "reload": ok}


@app.delete("/api/clients/{cid}")
def del_client(cid: str, request: Request):
    if (r := need_auth(request)):
        return r
    db.delete_client(cid)
    ok, err = xray.write_and_reload()
    db.add_log("client", f"deleted {cid}", client_ip(request))
    return {"ok": True, "reload": ok}


@app.get("/api/client/{cid}/links")
def client_links(cid: str, request: Request):
    if (r := need_auth(request)):
        return r
    c = db.get_client(cid)
    if not c:
        return JSONResponse({"error": "not found"}, status_code=404)
    sub_url = f"{sub_base()}/sub/{c['sub_token']}"
    return {"links": xray.client_links(c), "sub_url": sub_url}


# ─────────────────────────────── helpers ──────────────────────────────
@app.get("/api/genkeys")
def genkeys(request: Request):
    if (r := need_auth(request)):
        return r
    priv, pub = xray.gen_x25519()
    return {"uuid": str(uuid.uuid4()), "privateKey": priv, "publicKey": pub,
            "shortId": secrets.token_hex(4)}


@app.post("/api/settings")
async def update_settings(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    for k in ("theme", "lang", "server_addr", "panel_port", "panel_path",
              "bot_token", "bot_admins", "bot_api", "camouflage",
              "dns_servers", "sub_port", "sub_domain", "sub_path",
              # v1.0 settings tabs
              "cert_file", "key_file",                       # Certificates
              "timezone", "calendar",                        # Date and Time (+ Jalali)
              "notify_expiry_days", "notify_traffic_gb",     # Notifications
              "listen_ip", "listen_domain", "session_duration",
              "trusted_cidrs", "pagination_size", "restart_after_disable",
              "panel_outbound",                              # General
              "ext_traffic_enabled", "ext_traffic_url",      # External Traffic
              "ldap_enabled", "ldap_host", "ldap_port", "ldap_tls",
              "ldap_skip_verify", "ldap_bind_dn", "ldap_password", "ldap_base_dn",
              "ldap_user_filter", "ldap_user_attr", "ldap_flag_attr",
              "ldap_sync_schedule", "ldap_default_gb", "ldap_default_days",
              "twofa_enabled"):                              # Authentication
        if k in b and b[k] is not None:
            db.set_setting(k, str(b[k]).strip())
    if b.get("new_password") or b.get("new_username"):
        u = (b.get("new_username") or db.get_setting("admin_user") or "admin").strip()
        p = b.get("new_password")
        if p:
            auth.set_admin(u, p)
        else:
            db.set_setting("admin_user", u)
        db.add_log("settings", "credentials changed", client_ip(request))
    # DNS / certificate changes affect the running Xray config
    if any(k in b for k in ("dns_servers", "cert_file", "key_file")):
        try:
            xray.write_and_reload()
        except Exception:
            pass
    # apply the bot token live (restart the bot service if present)
    if "bot_token" in b or "bot_admins" in b:
        try:
            import subprocess
            subprocess.run(["systemctl", "restart", "vytrex-bot"],
                           timeout=15, capture_output=True)
        except Exception:
            pass
        db.add_log("settings", "telegram bot updated", client_ip(request))
    return {"ok": True, "note": "Changing panel_port requires: systemctl restart vytrex-panel"}


# ──────────────────────────── API token (Authentication tab) ────────────────────────────
@app.post("/api/api-token")
def gen_api_token_ep(request: Request):
    if (r := need_auth(request)):
        return r
    tok = auth.gen_api_token()
    db.set_setting("api_token", tok)
    db.add_log("settings", "API token regenerated", client_ip(request))
    return {"ok": True, "api_token": tok}


@app.delete("/api/api-token")
def revoke_api_token(request: Request):
    if (r := need_auth(request)):
        return r
    db.set_setting("api_token", "")
    db.add_log("settings", "API token revoked", client_ip(request))
    return {"ok": True}


# ──────────────────────────── Two-factor authentication ────────────────────────────
@app.post("/api/2fa/setup")
def twofa_setup(request: Request):
    """Generate a fresh TOTP secret and return an otpauth:// URI for the QR code.
    Not activated until /api/2fa/enable confirms a valid code."""
    if (r := need_auth(request)):
        return r
    secret = auth.gen_totp_secret()
    db.set_setting("twofa_secret", secret)
    db.set_setting("twofa_enabled", "")   # stays off until confirmed
    account = db.get_setting("admin_user", "admin")
    return {"ok": True, "secret": secret, "uri": auth.totp_uri(secret, account)}


@app.post("/api/2fa/enable")
async def twofa_enable(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    secret = db.get_setting("twofa_secret", "")
    if not secret:
        return JSONResponse({"error": "run setup first"}, status_code=400)
    if not auth.verify_totp(secret, str(b.get("otp", ""))):
        return JSONResponse({"error": "invalid code"}, status_code=400)
    db.set_setting("twofa_enabled", "1")
    db.add_log("settings", "2FA enabled", client_ip(request))
    return {"ok": True}


@app.post("/api/2fa/disable")
def twofa_disable(request: Request):
    if (r := need_auth(request)):
        return r
    db.set_setting("twofa_enabled", "")
    db.set_setting("twofa_secret", "")
    db.add_log("settings", "2FA disabled", client_ip(request))
    return {"ok": True}


@app.get("/api/logs")
def logs(request: Request):
    if (r := need_auth(request)):
        return r
    return {"logs": db.list_logs()}


@app.post("/api/reload")
def reload_xray(request: Request):
    if (r := need_auth(request)):
        return r
    ok, err = xray.write_and_reload()
    return {"ok": ok, "error": err}


# ─────────────────────────── system & online ──────────────────────────
@app.get("/api/system")
def sys_stats(request: Request):
    if (r := need_auth(request)):
        return r
    return system.snapshot()


@app.get("/api/online")
def online(request: Request):
    if (r := need_auth(request)):
        return r
    om = xray.online_map()
    return {"online": {e: ips for e, ips in om.items()},
            "violations": xray.enforce_ip_limits()}


@app.post("/api/client/{cid}/quota")
async def adjust_quota(cid: str, request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    db.adjust_client_quota(cid, int(b.get("delta_gb", 0)) * 1073741824)
    db.add_log("client", f"quota adjusted {cid} {b.get('delta_gb')}GB", client_ip(request))
    return {"ok": True}


# ─────────────────────────── outbounds / routing ──────────────────────
@app.post("/api/outbounds")
async def save_outbound(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    b.setdefault("tag", "out-" + secrets.token_hex(3))
    oid = db.upsert_outbound(b)
    ok, err = xray.write_and_reload()
    return {"ok": True, "id": oid, "reload": ok}


@app.delete("/api/outbounds/{oid}")
def del_outbound(oid: int, request: Request):
    if (r := need_auth(request)):
        return r
    db.delete_outbound(oid)
    ok, err = xray.write_and_reload()
    return {"ok": True, "reload": ok}


# ─────────────────────────── nodes (multi-location) ───────────────────
@app.post("/api/nodes")
async def save_node(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    nid = db.upsert_node(b)
    db.add_log("node", f"saved {b.get('name')}", client_ip(request))
    return {"ok": True, "id": nid}


@app.delete("/api/nodes/{nid}")
def del_node(nid: int, request: Request):
    if (r := need_auth(request)):
        return r
    db.delete_node(nid)
    return {"ok": True}


# ─────────────────────────── public subscription ──────────────────────
@app.get("/sub/{token}")
def subscription(token: str):
    c = db.get_client_by_token(token)
    if not c or not c["enabled"]:
        return PlainTextResponse("not found", status_code=404)
    if c.get("expiry"):
        try:
            if time.mktime(time.strptime(c["expiry"][:10], "%Y-%m-%d")) < time.time():
                return PlainTextResponse("expired", status_code=403)
        except Exception:
            pass
    headers = {"subscription-userinfo":
               f"upload=0; download={c['used_bytes'] or 0}; total={c['quota_bytes'] or 0}"}
    return PlainTextResponse(xray.subscription(c), headers=headers)


def _fmt_bytes(n):
    n = float(n or 0)
    for u in ["B", "KB", "MB", "GB", "TB"]:
        if n < 1024 or u == "TB":
            return f"{n:.2f} {u}" if u not in ("B", "KB") else f"{int(n)} {u}"
        n /= 1024


@app.get("/info/{token}", response_class=HTMLResponse)
def info_page(token: str):
    c = db.get_client_by_token(token)
    if not c:
        return HTMLResponse("<h1>404</h1>", status_code=404)
    tpl_path = os.path.join(FRONTEND_DIR, "info.html")
    tpl = open(tpl_path, encoding="utf-8").read() if os.path.isfile(tpl_path) else "{{NAME}}"
    used = int(c["used_bytes"] or 0); quota = int(c["quota_bytes"] or 0)
    percent = min(100, round(used / quota * 100)) if quota > 0 else 0
    remain = _fmt_bytes(max(0, quota - used)) if quota > 0 else "∞"
    days = "∞"; exp_class = ""; expiry = "∞"
    if c.get("expiry"):
        expiry = c["expiry"][:10]
        try:
            left = (time.mktime(time.strptime(expiry, "%Y-%m-%d")) - time.time()) / 86400
            days = str(max(0, int(left)))
            if left < 0:
                exp_class = "expired"; days = "0"
        except Exception:
            pass
    # Jalali (Shamsi) calendar display option
    if expiry not in ("∞", "") and db.get_setting("calendar", "gregorian") == "jalali":
        import jalali
        expiry = jalali.iso_to_jalali(expiry)
    sub_url = f"{sub_base()}/sub/{c['sub_token']}"
    links = xray.client_links(c)
    status = "Active" if (c["enabled"] and exp_class != "expired") else "Disabled"
    repl = {
        "{{NAME}}": c["email"], "{{USED}}": _fmt_bytes(used),
        "{{TOTAL}}": (_fmt_bytes(quota) if quota > 0 else "∞"), "{{REMAIN}}": remain,
        "{{PERCENT}}": str(percent), "{{EXPIRY}}": expiry, "{{EXP_CLASS}}": exp_class,
        "{{DAYS}}": days, "{{STATUS}}": status, "{{SUBURL}}": sub_url,
        "{{LINKS_JSON}}": json.dumps(links),
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))
    return HTMLResponse(tpl)


# ───────────────────────────── routing rules ─────────────────────────────
@app.post("/api/routing")
async def save_routing(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    rid = db.upsert_routing(b)
    ok, err = xray.write_and_reload()
    db.add_log("routing", f"saved rule {rid} reload={ok}", client_ip(request))
    return {"ok": True, "id": rid, "reload": ok, "error": err}


@app.delete("/api/routing/{rid}")
def del_routing(rid: int, request: Request):
    if (r := need_auth(request)):
        return r
    db.delete_routing(rid)
    ok, err = xray.write_and_reload()
    return {"ok": True, "reload": ok}


# ───────────────────────────── client actions ─────────────────────────────
@app.post("/api/client/{cid}/reset")
def reset_usage(cid: str, request: Request):
    if (r := need_auth(request)):
        return r
    db.reset_client_usage(cid)
    db.add_log("client", f"usage reset {cid}", client_ip(request))
    return {"ok": True}


# ───────────────────────────── credentials ─────────────────────────────
@app.post("/api/reset-credentials")
async def reset_credentials(request: Request):
    if (r := need_auth(request)):
        return r
    b = await request.json()
    user = (b.get("username") or db.get_setting("admin_user") or "admin").strip()
    pw = b.get("password") or ""
    if not pw:
        pw = secrets.token_urlsafe(9)
    auth.set_admin(user, pw)
    db.add_log("settings", "credentials reset", client_ip(request))
    return {"ok": True, "username": user, "password": pw}


# ───────────────────────────── backup / restore ─────────────────────────────
@app.get("/api/backup")
def backup(request: Request):
    if (r := need_auth(request)):
        return r
    # ensure WAL is flushed into the main db file
    try:
        db.conn().execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except Exception:
        pass
    fname = "vytrex-backup-" + time.strftime("%Y%m%d-%H%M%S") + ".db"
    return FileResponse(DB_PATH, filename=fname, media_type="application/octet-stream")


@app.post("/api/restore")
async def restore(request: Request):
    if (r := need_auth(request)):
        return r
    data = await request.body()
    if not data[:16].startswith(b"SQLite format 3"):
        return JSONResponse({"error": "not a valid Vytrex backup"}, status_code=400)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    # keep a safety copy of the current db first
    try:
        shutil.copy(DB_PATH, os.path.join(BACKUP_DIR, "pre-restore-" + time.strftime("%Y%m%d-%H%M%S") + ".db"))
    except Exception:
        pass
    with open(DB_PATH, "wb") as f:
        f.write(data)
    db.add_log("settings", "database restored from backup", client_ip(request))
    xray.write_and_reload()
    return {"ok": True, "note": "restored — restart the panel: systemctl restart vytrex-panel"}


@app.get("/api/health")
def health():
    return {"ok": True, "version": VERSION, "xray_running": xray.xray_running()}


# ── secret-path panel entry (must stay LAST so it doesn't shadow other routes) ──
@app.get("/{seg}", response_class=HTMLResponse)
def panel_entry(seg: str):
    if seg in RESERVED:
        return _not_found()
    pp = db.get_setting("panel_path", "")
    if pp:
        return _serve_index() if seg == pp else _not_found()
    # no secret path configured → serve the panel for any single-segment path
    return _serve_index()
