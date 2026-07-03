"""CLI used by install.sh to initialize the database, admin, and settings."""
import argparse, urllib.request, secrets, string
import db, auth


def rand_path(n=10):
    alpha = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alpha) for _ in range(n))


def public_ip():
    for url in ("https://api.ipify.org", "https://ifconfig.me/ip"):
        try:
            return urllib.request.urlopen(url, timeout=5).read().decode().strip()
        except Exception:
            continue
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="2099")
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", required=True)
    ap.add_argument("--domain", default="")
    ap.add_argument("--cert", default="")
    ap.add_argument("--key", default="")
    ap.add_argument("--bot-token", default="")
    ap.add_argument("--bot-admins", default="")
    ap.add_argument("--path", default="")   # secret panel path; blank -> auto-generate
    a = ap.parse_args()

    db.init_db()
    auth.set_admin(a.user, a.password)
    db.set_setting("panel_port", a.port)
    db.set_setting("panel_domain", a.domain)
    db.set_setting("server_addr", a.domain or public_ip())
    db.set_setting("cert_file", a.cert)
    db.set_setting("key_file", a.key)
    # secret panel path — required in the URL, so a bare IP:port reveals nothing
    path = (a.path or "").strip().strip("/")
    if not path:
        path = db.get_setting("panel_path", "") or rand_path()
    db.set_setting("panel_path", path)
    if a.bot_token:
        db.set_setting("bot_token", a.bot_token)
    if a.bot_admins:
        db.set_setting("bot_admins", a.bot_admins)
    if not db.get_setting("theme"):
        db.set_setting("theme", "dark")
    if not db.get_setting("lang"):
        db.set_setting("lang", "en")
    if not db.get_setting("calendar"):
        db.set_setting("calendar", "gregorian")
    if not db.get_setting("timezone"):
        db.set_setting("timezone", "Local")
    auth._secret()  # ensure a session secret exists
    # emit machine-readable path so install.sh can show it in the summary
    print("PANEL_PATH=" + path)
    print("Vytrex Panel initialized.")


if __name__ == "__main__":
    main()
