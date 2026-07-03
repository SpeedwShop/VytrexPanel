"""System metrics (CPU/RAM/disk/net/uptime) via /proc and os — no external deps."""
import os, time

_prev_cpu = None
_prev_net = None
_prev_t = None


def _read_cpu():
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()[1:]
        vals = list(map(int, parts))
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
        total = sum(vals)
        return idle, total
    except Exception:
        return None


def _read_net():
    rx = tx = 0
    try:
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:
                iface, _, data = line.partition(":")
                if iface.strip() in ("lo",):
                    continue
                cols = data.split()
                if len(cols) >= 9:
                    rx += int(cols[0]); tx += int(cols[8])
    except Exception:
        pass
    return rx, tx


def cpu_percent():
    global _prev_cpu
    cur = _read_cpu()
    if not cur:
        return 0.0
    if _prev_cpu is None:
        _prev_cpu = cur
        time.sleep(0.05)
        cur = _read_cpu()
    idle0, total0 = _prev_cpu
    idle1, total1 = cur
    _prev_cpu = cur
    dt = total1 - total0
    di = idle1 - idle0
    if dt <= 0:
        return 0.0
    return round(100.0 * (dt - di) / dt, 1)


def mem():
    info = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                k, _, v = line.partition(":")
                info[k.strip()] = int(v.split()[0]) * 1024  # kB -> bytes
    except Exception:
        return {"total": 0, "used": 0, "percent": 0}
    total = info.get("MemTotal", 0)
    avail = info.get("MemAvailable", info.get("MemFree", 0))
    used = total - avail
    return {"total": total, "used": used, "percent": round(100 * used / total, 1) if total else 0}


def disk(path="/"):
    try:
        s = os.statvfs(path)
        total = s.f_blocks * s.f_frsize
        free = s.f_bavail * s.f_frsize
        used = total - free
        return {"total": total, "used": used, "percent": round(100 * used / total, 1) if total else 0}
    except Exception:
        return {"total": 0, "used": 0, "percent": 0}


def uptime():
    try:
        with open("/proc/uptime") as f:
            return int(float(f.read().split()[0]))
    except Exception:
        return 0


def loadavg():
    try:
        return list(os.getloadavg())
    except Exception:
        return [0, 0, 0]


def net_speed():
    """bytes/sec since last call."""
    global _prev_net, _prev_t
    rx, tx = _read_net()
    now = time.time()
    if _prev_net is None:
        _prev_net = (rx, tx); _prev_t = now
        return {"rx": 0, "tx": 0, "rx_total": rx, "tx_total": tx}
    dt = max(0.001, now - _prev_t)
    d = {"rx": int((rx - _prev_net[0]) / dt), "tx": int((tx - _prev_net[1]) / dt),
         "rx_total": rx, "tx_total": tx}
    _prev_net = (rx, tx); _prev_t = now
    return d


def snapshot():
    return {
        "cpu": cpu_percent(),
        "mem": mem(),
        "disk": disk("/"),
        "uptime": uptime(),
        "load": loadavg(),
        "net": net_speed(),
        "cores": os.cpu_count() or 1,
    }
