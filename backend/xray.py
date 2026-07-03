"""Xray-core integration: build config.json, reload service, read stats, build share links."""
import json, subprocess, base64, urllib.parse, shutil, os, re, time
import db
from config import XRAY_CONFIG, XRAY_BIN, XRAY_SERVICE, STATS_API_PORT

ACCESS_LOG = os.environ.get("XRAY_ACCESS_LOG", "/usr/local/etc/xray/access.log")


# ─────────────────────────── key generation ───────────────────────────
def gen_x25519():
    """Return (privateKey, publicKey) for Reality, using `xray x25519`."""
    try:
        out = subprocess.check_output([XRAY_BIN, "x25519"], text=True, timeout=10)
        priv = pub = ""
        for line in out.splitlines():
            low = line.lower()
            if "private" in low:
                priv = line.split(":", 1)[1].strip()
            elif "public" in low:
                pub = line.split(":", 1)[1].strip()
        return priv, pub
    except Exception:
        return "", ""


# ─────────────────────────── config builder ───────────────────────────
def _stream_settings(inb):
    net = inb["network"]
    sec = inb["security"]
    stream = json.loads(inb.get("stream") or "{}")
    ss = {"network": net, "security": sec}

    if net == "ws":
        ss["wsSettings"] = {"path": stream.get("path", "/"), "headers": {"Host": stream.get("host", "")}}
    elif net == "grpc":
        ss["grpcSettings"] = {"serviceName": stream.get("serviceName", "vytrex")}
    elif net == "httpupgrade":
        ss["httpupgradeSettings"] = {"path": stream.get("path", "/"), "host": stream.get("host", "")}
    elif net == "xhttp":
        ss["xhttpSettings"] = {"path": stream.get("path", "/"), "host": stream.get("host", ""),
                                "mode": stream.get("mode", "auto")}
    elif net == "tcp":
        ss["tcpSettings"] = {"header": {"type": "none"}}

    if sec == "tls":
        ss["tlsSettings"] = {
            "serverName": stream.get("sni", db.get_setting("server_addr", "")),
            "alpn": stream.get("alpn", ["h2", "http/1.1"]),
            "certificates": [{
                "certificateFile": db.get_setting("cert_file", ""),
                "keyFile": db.get_setting("key_file", ""),
            }],
        }
    elif sec == "reality":
        ss["realitySettings"] = {
            "show": False,
            "dest": stream.get("dest", "www.microsoft.com:443"),
            "xver": 0,
            "serverNames": stream.get("serverNames", ["www.microsoft.com"]),
            "privateKey": stream.get("privateKey", ""),
            "shortIds": stream.get("shortIds", [""]),
        }
    return ss


def _protocol_settings(inb, clients):
    proto = inb["protocol"]
    isettings = json.loads(inb.get("settings") or "{}")
    active = [c for c in clients if c["enabled"]]
    cl = []
    for c in active:
        if proto == "vless":
            entry = {"id": c["secret"], "email": c["email"]}
            # xtls-rprx-vision flow only valid on raw TCP + Reality/TLS (never on ws/grpc)
            if inb["security"] in ("reality", "tls") and inb["network"] == "tcp":
                entry["flow"] = "xtls-rprx-vision"
            cl.append(entry)
        elif proto == "vmess":
            cl.append({"id": c["secret"], "email": c["email"], "alterId": 0})
        elif proto == "trojan":
            cl.append({"password": c["secret"], "email": c["email"]})
    if proto == "vless":
        return {"clients": cl, "decryption": "none"}
    if proto in ("vmess", "trojan"):
        return {"clients": cl}
    if proto == "shadowsocks":
        method = isettings.get("method", "aes-256-gcm")
        ss = {"network": "tcp,udp"}
        if method.startswith("2022"):
            ss["method"] = method
            ss["clients"] = [{"password": c["secret"], "email": c["email"]} for c in active]
        else:
            # classic single-user shadowsocks (uses the first enabled client's secret)
            ss["method"] = method
            ss["password"] = active[0]["secret"] if active else ""
            if active:
                ss["email"] = active[0]["email"]
        return ss
    return {"clients": cl}


def build_config():
    inbounds = []
    for inb in db.list_inbounds():
        if not inb["enabled"]:
            continue
        clients = db.list_clients(inb["id"])
        inbounds.append({
            "tag": inb["tag"],
            "listen": inb.get("listen", "0.0.0.0"),
            "port": int(inb["port"]),
            "protocol": inb["protocol"],
            "settings": _protocol_settings(inb, clients),
            "streamSettings": _stream_settings(inb),
            "sniffing": {"enabled": True, "destOverride": ["http", "tls", "quic"]},
        })

    # local stats/api inbound
    inbounds.append({
        "tag": "api", "listen": "127.0.0.1", "port": STATS_API_PORT,
        "protocol": "dokodemo-door", "settings": {"address": "127.0.0.1"},
    })

    cfg = {
        "log": {"loglevel": "warning", "access": ACCESS_LOG},
        "stats": {},
        "api": {"tag": "api", "services": ["HandlerService", "StatsService"]},
        "policy": {
            "levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}},
            "system": {"statsInboundUplink": True, "statsInboundDownlink": True},
        },
        "inbounds": inbounds,
        "outbounds": build_outbounds(),
        "routing": {"domainStrategy": "AsIs", "rules": build_routing()},
    }
    dns = build_dns()
    if dns:
        cfg["dns"] = dns
    return cfg


def build_dns():
    """Optional DNS block from the 'dns_servers' setting (comma-separated)."""
    raw = (db.get_setting("dns_servers", "") or "").strip()
    if not raw:
        return None
    servers = [s.strip() for s in raw.replace("\n", ",").split(",") if s.strip()]
    return {"servers": servers} if servers else None


def build_routing():
    """Build routing rules: api first, then user-defined rules, then a direct default."""
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    valid_out = {o["tag"] for o in build_outbounds()}
    for r in db.list_routing():
        if not r.get("enabled"):
            continue
        out = (r.get("outbound_tag") or "").strip()
        if out not in valid_out:
            continue
        rule = {"type": "field", "outboundTag": out}
        src = (r.get("source_tag") or "").strip()
        if src:
            rule["inboundTag"] = [t.strip() for t in src.split(",") if t.strip()]
        dom = (r.get("domains") or "").strip()
        if dom:
            rule["domain"] = [d.strip() for d in dom.replace("\n", ",").split(",") if d.strip()]
        ips = (r.get("ips") or "").strip()
        if ips:
            rule["ip"] = [i.strip() for i in ips.replace("\n", ",").split(",") if i.strip()]
        ports = (r.get("ports") or "").strip()
        if ports:
            rule["port"] = ports
        # a rule must carry at least one matcher besides the outbound
        if any(k in rule for k in ("inboundTag", "domain", "ip", "port")):
            rules.append(rule)
    return rules


def build_outbounds():
    outs = [
        {"tag": "direct", "protocol": "freedom", "settings": {"domainStrategy": "UseIP"}},
        {"tag": "blocked", "protocol": "blackhole"},
    ]
    for o in db.list_outbounds():
        if not o["enabled"]:
            continue
        try:
            entry = {"tag": o["tag"], "protocol": o["protocol"],
                     "settings": json.loads(o.get("settings") or "{}")}
            stream = json.loads(o.get("stream") or "{}")
            if stream:
                entry["streamSettings"] = stream
            outs.append(entry)
        except Exception:
            pass
    return outs


def test_config(path=None):
    """Run `xray test -c <path>` and return (ok, message). Helps diagnose bad inbounds."""
    path = path or XRAY_CONFIG
    try:
        r = subprocess.run([XRAY_BIN, "test", "-c", path],
                           capture_output=True, text=True, timeout=20)
        if r.returncode == 0:
            return True, ""
        msg = (r.stderr or r.stdout or "").strip()
        # keep the most relevant tail of the error
        return False, msg.splitlines()[-1] if msg else "xray config test failed"
    except FileNotFoundError:
        return True, ""   # xray not installed yet (install-time); don't block
    except Exception as e:
        return True, str(e)


def write_and_reload():
    try:
        cfg = build_config()
        os.makedirs(os.path.dirname(XRAY_CONFIG), exist_ok=True)
        with open(XRAY_CONFIG, "w") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        return False, f"write failed: {e}"
    # validate before restarting so a bad inbound can't take the whole service down
    ok, msg = test_config()
    if not ok:
        try:
            db.add_log("xray", "config test FAILED: " + msg[:180])
        except Exception:
            pass
        return False, "config invalid: " + msg
    return restart()


def restart():
    try:
        subprocess.run(["systemctl", "restart", XRAY_SERVICE], check=True, timeout=30)
        return True, ""
    except Exception as e:
        return False, str(e)


def xray_running():
    try:
        r = subprocess.run(["systemctl", "is-active", XRAY_SERVICE], capture_output=True, text=True, timeout=10)
        return r.stdout.strip() == "active"
    except Exception:
        return False


# ─────────────────────────── traffic stats ───────────────────────────
def fetch_stats():
    """Query Xray stats API and update per-client used_bytes. Returns dict email->bytes."""
    try:
        out = subprocess.check_output(
            [XRAY_BIN, "api", "statsquery", f"--server=127.0.0.1:{STATS_API_PORT}"],
            text=True, timeout=10)
        data = json.loads(out or "{}")
    except Exception:
        return {}
    totals = {}
    for stat in data.get("stat", []) or []:
        name = stat.get("name", "")
        val = int(stat.get("value", 0) or 0)
        # name like: user>>>email>>>traffic>>>uplink
        parts = name.split(">>>")
        if len(parts) == 4 and parts[0] == "user":
            totals[parts[1]] = totals.get(parts[1], 0) + val
    for email, used in totals.items():
        db.set_client_usage(email, used)
    return totals


# ─────────────────────────── share links ───────────────────────────
def _addr():
    return db.get_setting("server_addr", "") or "YOUR_SERVER"


def build_link(inb, client):
    proto = inb["protocol"]
    net = inb["network"]
    sec = inb["security"]
    stream = json.loads(inb.get("stream") or "{}")
    host = stream.get("host", "") or _addr()
    sni = stream.get("sni", "") or db.get_setting("server_addr", "") or host
    addr = _addr()
    port = int(inb["port"])
    remark = f"{inb.get('remark') or inb['tag']}-{client['email']}"

    q = {"type": net, "security": sec}
    # VLESS clients (v2rayN/NG, Hiddify, sing-box) REQUIRE encryption=none in the URL,
    # otherwise the imported config is rejected and never connects.
    if proto == "vless":
        q["encryption"] = "none"
    if net == "ws":
        q["path"] = stream.get("path", "/"); q["host"] = host
    elif net == "grpc":
        q["serviceName"] = stream.get("serviceName", "vytrex"); q["mode"] = "gun"
    elif net == "httpupgrade":
        q["path"] = stream.get("path", "/"); q["host"] = host
    elif net == "xhttp":
        q["path"] = stream.get("path", "/"); q["host"] = host; q["mode"] = stream.get("mode", "auto")
    elif net == "tcp":
        q["headerType"] = "none"

    if sec == "tls":
        q["sni"] = sni; q["fp"] = "chrome"; q["alpn"] = "h2,http/1.1"
        if proto == "vless" and net == "tcp":
            q["flow"] = "xtls-rprx-vision"
    elif sec == "reality":
        q["sni"] = (stream.get("serverNames", ["www.microsoft.com"]) or ["www.microsoft.com"])[0]
        q["fp"] = "chrome"
        q["pbk"] = stream.get("publicKey", "")
        q["sid"] = (stream.get("shortIds", [""]) or [""])[0]
        q["spx"] = "/"
        if proto == "vless" and net == "tcp":
            q["flow"] = "xtls-rprx-vision"

    query = urllib.parse.urlencode({k: v for k, v in q.items() if v != ""})

    if proto == "shadowsocks":
        isettings = json.loads(inb.get("settings") or "{}")
        method = isettings.get("method", "aes-256-gcm")
        userinfo = base64.b64encode(f"{method}:{client['secret']}".encode()).decode().rstrip("=")
        return f"ss://{userinfo}@{addr}:{port}#{urllib.parse.quote(remark)}"
    if proto == "vless":
        return f"vless://{client['secret']}@{addr}:{port}?{query}#{urllib.parse.quote(remark)}"
    if proto == "trojan":
        return f"trojan://{client['secret']}@{addr}:{port}?{query}#{urllib.parse.quote(remark)}"
    if proto == "vmess":
        v = {"v": "2", "ps": remark, "add": addr, "port": str(port), "id": client["secret"],
             "aid": "0", "scy": "auto", "net": net, "type": "none", "host": host,
             "path": stream.get("path", "/"), "tls": "tls" if sec == "tls" else "",
             "sni": sni if sec == "tls" else ""}
        if net == "grpc":
            v["path"] = stream.get("serviceName", "vytrex"); v["type"] = "gun"
        return "vmess://" + base64.b64encode(json.dumps(v).encode()).decode()
    return ""


def client_links(client):
    inb = db.get_inbound(client["inbound_id"])
    if not inb:
        return []
    return [build_link(inb, client)]


def subscription(client):
    return base64.b64encode("\n".join(client_links(client)).encode()).decode()


# ─────────────────────────── online users ─────────────────────────────
_LINE_RE = re.compile(
    r"^(?P<ts>\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*?from (?P<ip>[0-9a-fA-F\.:]+):\d+.*?email:\s*(?P<email>\S+)")


def online_map(window=120, tail_bytes=400_000):
    """Return {email: [distinct recent IPs]} parsed from the Xray access log."""
    out = {}
    try:
        size = os.path.getsize(ACCESS_LOG)
        with open(ACCESS_LOG, "rb") as f:
            if size > tail_bytes:
                f.seek(-tail_bytes, os.SEEK_END)
            data = f.read().decode(errors="ignore")
    except Exception:
        return out
    now = time.time()
    for line in data.splitlines():
        m = _LINE_RE.match(line)
        if not m:
            continue
        try:
            ts = time.mktime(time.strptime(m.group("ts"), "%Y/%m/%d %H:%M:%S"))
        except Exception:
            continue
        if now - ts > window:
            continue
        out.setdefault(m.group("email"), set()).add(m.group("ip"))
    return {k: sorted(v) for k, v in out.items()}


def enforce_ip_limits():
    """Best-effort: log clients exceeding their IP limit (hard drop needs a proxy restart)."""
    om = online_map()
    violations = []
    for c in db.list_clients():
        lim = int(c.get("ip_limit") or 0)
        ips = om.get(c["email"], [])
        if lim and len(ips) > lim:
            violations.append({"email": c["email"], "ips": ips, "limit": lim})
    return violations


def enforce_quotas_and_expiry():
    """Auto-activate on-hold clients on first traffic, and auto-disable clients that
    hit their quota or expiry. Returns True if any client changed (caller reloads xray)."""
    changed = False
    om = None
    for c in db.list_clients():
        # on-hold -> activate the moment we see traffic
        if int(c.get("on_hold") or 0):
            if om is None:
                om = online_map()
            if om.get(c["email"]):
                db.activate_on_hold(c["id"], int(c.get("total_days") or 0))
                db.add_log("client", f"on-hold activated {c['email']}")
                changed = True
            continue
        if not c["enabled"]:
            continue
        used = int(c.get("used_bytes") or 0)
        quota = int(c.get("quota_bytes") or 0)
        if quota > 0 and used >= quota:
            db.set_client_enabled(c["id"], False)
            db.add_log("client", f"auto-disabled (quota) {c['email']}")
            changed = True
            continue
        exp = c.get("expiry") or ""
        if exp:
            try:
                if time.mktime(time.strptime(exp[:10], "%Y-%m-%d")) + 86400 < time.time():
                    db.set_client_enabled(c["id"], False)
                    db.add_log("client", f"auto-disabled (expired) {c['email']}")
                    changed = True
            except Exception:
                pass
    return changed
