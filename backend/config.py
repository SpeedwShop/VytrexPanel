"""Central paths / constants for Vytrex Panel."""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /opt/vytrex-panel
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
CERTS_DIR = os.path.join(BASE_DIR, "certs")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "vytrex.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")

# Xray integration
XRAY_CONFIG = os.environ.get("XRAY_CONFIG", "/usr/local/etc/xray/config.json")
XRAY_BIN = os.environ.get("XRAY_BIN", "xray")
XRAY_SERVICE = os.environ.get("XRAY_SERVICE", "xray")
STATS_API_PORT = 10085  # local-only Xray stats/api inbound

VERSION = "1.0.0"
