"""SQLite storage layer for Vytrex Panel (stdlib only)."""
import sqlite3, json, threading, time, uuid
from config import DB_PATH

_lock = threading.Lock()
_conn = None


def conn():
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
    return _conn


def _safe_alter(sql):
    try:
        conn().execute(sql); conn().commit()
    except Exception:
        pass


def init_db():
    c = conn()
    with _lock:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS inbounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT UNIQUE, remark TEXT,
                protocol TEXT, network TEXT, security TEXT,
                port INTEGER, listen TEXT DEFAULT '0.0.0.0',
                settings TEXT, stream TEXT,
                enabled INTEGER DEFAULT 1, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY, inbound_id INTEGER,
                email TEXT, secret TEXT,
                quota_bytes INTEGER DEFAULT 0, used_bytes INTEGER DEFAULT 0,
                expiry TEXT, ip_limit INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1, note TEXT,
                sub_token TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS outbounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT UNIQUE, protocol TEXT, settings TEXT, stream TEXT,
                enabled INTEGER DEFAULT 1, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT, location TEXT, address TEXT, api_url TEXT, secret TEXT,
                enabled INTEGER DEFAULT 1, status TEXT DEFAULT 'unknown', last_seen TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, type TEXT, detail TEXT, ip TEXT
            );
            CREATE TABLE IF NOT EXISTS routing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                remark TEXT, source_tag TEXT, outbound_tag TEXT,
                domains TEXT, ips TEXT, ports TEXT,
                enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created_at TEXT
            );
            """
        )
        c.commit()
    # forward-compat columns for older installs
    _safe_alter("ALTER TABLE clients ADD COLUMN ip_limit INTEGER DEFAULT 0")
    _safe_alter("ALTER TABLE clients ADD COLUMN note TEXT")
    # on_hold: quota/expiry countdown only starts on first connection (0 = off)
    _safe_alter("ALTER TABLE clients ADD COLUMN on_hold INTEGER DEFAULT 0")
    _safe_alter("ALTER TABLE clients ADD COLUMN total_days INTEGER DEFAULT 0")
    _safe_alter("ALTER TABLE clients ADD COLUMN first_seen TEXT")


# ---------------- settings kv ----------------
def get_setting(key, default=None):
    r = conn().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return r["value"] if r else default


def set_setting(key, value):
    with _lock:
        conn().execute(
            "INSERT INTO settings(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
        conn().commit()


def all_settings():
    return {r["key"]: r["value"] for r in conn().execute("SELECT key,value FROM settings").fetchall()}


# ---------------- inbounds ----------------
def list_inbounds():
    return [dict(r) for r in conn().execute("SELECT * FROM inbounds ORDER BY id").fetchall()]


def get_inbound(iid):
    r = conn().execute("SELECT * FROM inbounds WHERE id=?", (iid,)).fetchone()
    return dict(r) if r else None


def create_inbound(d):
    with _lock:
        cur = conn().execute(
            "INSERT INTO inbounds(tag,remark,protocol,network,security,port,listen,settings,stream,enabled,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (d["tag"], d.get("remark", ""), d["protocol"], d["network"], d.get("security", "none"),
             int(d["port"]), d.get("listen", "0.0.0.0"),
             json.dumps(d.get("settings", {})), json.dumps(d.get("stream", {})),
             1 if d.get("enabled", True) else 0, time.strftime("%Y-%m-%dT%H:%M:%SZ")))
        conn().commit()
        return cur.lastrowid


def update_inbound(iid, d):
    with _lock:
        conn().execute(
            "UPDATE inbounds SET remark=?,protocol=?,network=?,security=?,port=?,listen=?,settings=?,stream=?,enabled=? WHERE id=?",
            (d.get("remark", ""), d["protocol"], d["network"], d.get("security", "none"), int(d["port"]),
             d.get("listen", "0.0.0.0"),
             json.dumps(d.get("settings", {})), json.dumps(d.get("stream", {})),
             1 if d.get("enabled", True) else 0, iid))
        conn().commit()


def delete_inbound(iid):
    with _lock:
        conn().execute("DELETE FROM clients WHERE inbound_id=?", (iid,))
        conn().execute("DELETE FROM inbounds WHERE id=?", (iid,))
        conn().commit()


# ---------------- clients ----------------
def list_clients(inbound_id=None):
    if inbound_id is None:
        rows = conn().execute("SELECT * FROM clients ORDER BY created_at DESC").fetchall()
    else:
        rows = conn().execute("SELECT * FROM clients WHERE inbound_id=? ORDER BY created_at DESC", (inbound_id,)).fetchall()
    return [dict(r) for r in rows]


def get_client(cid):
    r = conn().execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
    return dict(r) if r else None


def get_client_by_token(tok):
    r = conn().execute("SELECT * FROM clients WHERE sub_token=?", (tok,)).fetchone()
    return dict(r) if r else None


def upsert_client(d):
    cid = d.get("id") or uuid.uuid4().hex
    with _lock:
        conn().execute(
            "INSERT INTO clients(id,inbound_id,email,secret,quota_bytes,used_bytes,expiry,ip_limit,enabled,note,on_hold,total_days,sub_token,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(id) DO UPDATE SET email=excluded.email,secret=excluded.secret,"
            " quota_bytes=excluded.quota_bytes,expiry=excluded.expiry,ip_limit=excluded.ip_limit,"
            " enabled=excluded.enabled,note=excluded.note,on_hold=excluded.on_hold,total_days=excluded.total_days",
            (cid, int(d["inbound_id"]), d["email"], d["secret"], int(d.get("quota_bytes", 0)),
             int(d.get("used_bytes", 0)), d.get("expiry", ""), int(d.get("ip_limit", 0)),
             1 if d.get("enabled", True) else 0, d.get("note", ""),
             1 if d.get("on_hold") else 0, int(d.get("total_days", 0) or 0),
             d.get("sub_token") or uuid.uuid4().hex, d.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ")))
        conn().commit()
    return cid


def set_client_enabled(cid, enabled):
    with _lock:
        conn().execute("UPDATE clients SET enabled=? WHERE id=?", (1 if enabled else 0, cid)); conn().commit()


def reset_client_usage(cid):
    with _lock:
        conn().execute("UPDATE clients SET used_bytes=0 WHERE id=?", (cid,)); conn().commit()


def activate_on_hold(cid, days):
    """Convert an on-hold client into an active one, setting expiry from now."""
    exp = time.strftime("%Y-%m-%d", time.gmtime(time.time() + int(days) * 86400)) if days else ""
    with _lock:
        conn().execute("UPDATE clients SET on_hold=0, expiry=?, first_seen=? WHERE id=? AND on_hold=1",
                       (exp, time.strftime("%Y-%m-%dT%H:%M:%SZ"), cid)); conn().commit()


def delete_client(cid):
    with _lock:
        conn().execute("DELETE FROM clients WHERE id=?", (cid,)); conn().commit()


def set_client_usage(email, used):
    with _lock:
        conn().execute("UPDATE clients SET used_bytes=? WHERE email=?", (int(used), email)); conn().commit()


def adjust_client_quota(cid, delta_bytes):
    with _lock:
        conn().execute("UPDATE clients SET quota_bytes=MAX(0,quota_bytes+?) WHERE id=?", (int(delta_bytes), cid))
        conn().commit()


# ---------------- outbounds ----------------
def list_outbounds():
    return [dict(r) for r in conn().execute("SELECT * FROM outbounds ORDER BY id").fetchall()]


def upsert_outbound(d):
    with _lock:
        if d.get("id"):
            conn().execute("UPDATE outbounds SET tag=?,protocol=?,settings=?,stream=?,enabled=? WHERE id=?",
                           (d["tag"], d["protocol"], json.dumps(d.get("settings", {})),
                            json.dumps(d.get("stream", {})), 1 if d.get("enabled", True) else 0, int(d["id"])))
            oid = int(d["id"])
        else:
            cur = conn().execute("INSERT INTO outbounds(tag,protocol,settings,stream,enabled,created_at) VALUES(?,?,?,?,?,?)",
                                 (d["tag"], d["protocol"], json.dumps(d.get("settings", {})),
                                  json.dumps(d.get("stream", {})), 1 if d.get("enabled", True) else 0,
                                  time.strftime("%Y-%m-%dT%H:%M:%SZ")))
            oid = cur.lastrowid
        conn().commit()
        return oid


def delete_outbound(oid):
    with _lock:
        conn().execute("DELETE FROM outbounds WHERE id=?", (oid,)); conn().commit()


# ---------------- nodes ----------------
def list_nodes():
    return [dict(r) for r in conn().execute("SELECT * FROM nodes ORDER BY id").fetchall()]


def upsert_node(d):
    with _lock:
        if d.get("id"):
            conn().execute("UPDATE nodes SET name=?,location=?,address=?,api_url=?,secret=?,enabled=? WHERE id=?",
                           (d["name"], d.get("location", ""), d.get("address", ""), d.get("api_url", ""),
                            d.get("secret", ""), 1 if d.get("enabled", True) else 0, int(d["id"])))
            nid = int(d["id"])
        else:
            cur = conn().execute("INSERT INTO nodes(name,location,address,api_url,secret,enabled,created_at) VALUES(?,?,?,?,?,?,?)",
                                 (d["name"], d.get("location", ""), d.get("address", ""), d.get("api_url", ""),
                                  d.get("secret", ""), 1 if d.get("enabled", True) else 0,
                                  time.strftime("%Y-%m-%dT%H:%M:%SZ")))
            nid = cur.lastrowid
        conn().commit()
        return nid


def delete_node(nid):
    with _lock:
        conn().execute("DELETE FROM nodes WHERE id=?", (nid,)); conn().commit()


def set_node_status(nid, status):
    with _lock:
        conn().execute("UPDATE nodes SET status=?,last_seen=? WHERE id=?",
                       (status, time.strftime("%Y-%m-%dT%H:%M:%SZ"), nid)); conn().commit()


# ---------------- routing rules ----------------
def list_routing():
    return [dict(r) for r in conn().execute("SELECT * FROM routing ORDER BY sort, id").fetchall()]


def upsert_routing(d):
    with _lock:
        if d.get("id"):
            conn().execute(
                "UPDATE routing SET remark=?,source_tag=?,outbound_tag=?,domains=?,ips=?,ports=?,enabled=?,sort=? WHERE id=?",
                (d.get("remark", ""), d.get("source_tag", ""), d.get("outbound_tag", ""),
                 d.get("domains", ""), d.get("ips", ""), d.get("ports", ""),
                 1 if d.get("enabled", True) else 0, int(d.get("sort", 0) or 0), int(d["id"])))
            rid = int(d["id"])
        else:
            cur = conn().execute(
                "INSERT INTO routing(remark,source_tag,outbound_tag,domains,ips,ports,enabled,sort,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (d.get("remark", ""), d.get("source_tag", ""), d.get("outbound_tag", ""),
                 d.get("domains", ""), d.get("ips", ""), d.get("ports", ""),
                 1 if d.get("enabled", True) else 0, int(d.get("sort", 0) or 0),
                 time.strftime("%Y-%m-%dT%H:%M:%SZ")))
            rid = cur.lastrowid
        conn().commit()
        return rid


def delete_routing(rid):
    with _lock:
        conn().execute("DELETE FROM routing WHERE id=?", (rid,)); conn().commit()


# ---------------- logs ----------------
def add_log(type_, detail, ip=""):
    with _lock:
        conn().execute("INSERT INTO logs(ts,type,detail,ip) VALUES(?,?,?,?)",
                       (time.strftime("%Y-%m-%dT%H:%M:%SZ"), type_, detail, ip))
        conn().execute("DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 500)")
        conn().commit()


def list_logs(limit=150):
    return [dict(r) for r in conn().execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()]
