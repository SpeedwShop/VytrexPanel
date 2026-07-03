"""Auth: PBKDF2 password hashing + HMAC-signed session tokens + TOTP 2FA + API token (stdlib only)."""
import hashlib, hmac, os, base64, time, struct, secrets
import db


# ───────────────────────── TOTP 2-factor auth (RFC 6238, stdlib only) ─────────────────────────
_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def gen_totp_secret(length: int = 20) -> str:
    """Return a base32 secret compatible with Google Authenticator / any TOTP app."""
    raw = os.urandom(length)
    return "".join(_B32[b % 32] for b in raw)


def _b32decode(s: str) -> bytes:
    s = s.strip().replace(" ", "").upper()
    s += "=" * ((8 - len(s) % 8) % 8)
    return base64.b32decode(s)


def totp_now(secret: str, t: int = None, step: int = 30, digits: int = 6) -> str:
    if t is None:
        t = int(time.time())
    counter = struct.pack(">Q", t // step)
    mac = hmac.new(_b32decode(secret), counter, hashlib.sha1).digest()
    off = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[off:off + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Accept the current code +/- `window` steps to tolerate clock drift."""
    if not (secret and code):
        return False
    code = str(code).strip().replace(" ", "")
    now = int(time.time())
    for w in range(-window, window + 1):
        if hmac.compare_digest(totp_now(secret, now + w * 30), code):
            return True
    return False


def totp_uri(secret: str, account: str = "admin", issuer: str = "Vytrex Panel") -> str:
    import urllib.parse
    label = urllib.parse.quote(f"{issuer}:{account}")
    q = urllib.parse.urlencode({"secret": secret, "issuer": issuer, "digits": 6, "period": 30})
    return f"otpauth://totp/{label}?{q}"


# ───────────────────────── API token (header auth for automation) ─────────────────────────
def gen_api_token() -> str:
    return "vx_" + secrets.token_urlsafe(30)


def verify_api_token(token: str) -> bool:
    stored = db.get_setting("api_token", "")
    return bool(stored) and bool(token) and hmac.compare_digest(token, stored)


def hash_password(password: str, salt: str = None):
    if salt is None:
        salt = base64.b16encode(os.urandom(16)).decode()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return salt, base64.b16encode(dk).decode()


def set_admin(username: str, password: str):
    salt, h = hash_password(password)
    db.set_setting("admin_user", username)
    db.set_setting("admin_salt", salt)
    db.set_setting("admin_hash", h)


def verify_login(username: str, password: str) -> bool:
    u = db.get_setting("admin_user")
    salt = db.get_setting("admin_salt")
    stored = db.get_setting("admin_hash")
    if not (u and salt and stored):
        return False
    if username != u:
        return False
    _, h = hash_password(password, salt)
    return hmac.compare_digest(h, stored)


def _secret() -> str:
    s = db.get_setting("secret_key")
    if not s:
        s = base64.b16encode(os.urandom(32)).decode()
        db.set_setting("secret_key", s)
    return s


def make_session(hours: int = 12) -> str:
    exp = int(time.time()) + hours * 3600
    payload = f"vytrex.{exp}"
    sig = hmac.new(_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_session(token: str) -> bool:
    if not token:
        return False
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "vytrex":
        return False
    try:
        if int(parts[1]) < time.time():
            return False
    except ValueError:
        return False
    expected = hmac.new(_secret().encode(), f"vytrex.{parts[1]}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(parts[2], expected)
