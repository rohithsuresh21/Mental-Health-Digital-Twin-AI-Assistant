"""Desktop entry point: starts the local server + opens the app window.

Run (installed):  <install>\\python\\pythonw.exe <install>\\app\\desktop\\launcher.py
Run (dev):        venv\\Scripts\\python.exe desktop\\launcher.py      (pip install waitress first)
Flags: --no-window (server only), --port N, --stop
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from desktop import runtime_env  # noqa: E402

HOST = "127.0.0.1"
DEFAULT_PORT = 47821            # fixed so the origin (cookies/localStorage) stays stable
CREATE_NEW_CONSOLE = 0x00000010
CREATE_NO_WINDOW = 0x08000000


def _redirect_output(log_file: Path):
    f = open(log_file, "a", encoding="utf-8", buffering=1, errors="replace")
    sys.stdout = f
    sys.stderr = f
    print(f"\n===== launch {time.strftime('%Y-%m-%d %H:%M:%S')} =====", flush=True)


def _msgbox(text, title="Mental Health Digital Twin"):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, text, title, 0x40)
    except Exception:
        print(text)


def _status(port, timeout=1.5):
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/__mhdt/status", timeout=timeout) as r:
            data = json.loads(r.read().decode())
            return data if data.get("app") == "mhdt" else None
    except Exception:
        return None


def _port_free(port):
    """Free = nothing is listening. (A plain bind() test also fails on ports in TIME_WAIT after a
    restart, which would push the app onto a random port and lose the browser's saved identity.)"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        if s.connect_ex((HOST, port)) == 0:
            return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if os.name != "nt":
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False


def _free_port():
    with socket.socket() as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def _find_browser():
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    lad = os.environ.get("LOCALAPPDATA", "")
    for p in (
        rf"{pf86}\Microsoft\Edge\Application\msedge.exe",
        rf"{pf}\Microsoft\Edge\Application\msedge.exe",
        rf"{lad}\Microsoft\Edge\Application\msedge.exe",
        rf"{pf}\Google\Chrome\Application\chrome.exe",
        rf"{pf86}\Google\Chrome\Application\chrome.exe",
        rf"{lad}\Google\Chrome\Application\chrome.exe",
    ):
        if p and os.path.exists(p):
            return p
    return None


def open_window(url):
    exe = _find_browser()
    if exe:
        runtime_env.EDGE_PROFILE.mkdir(parents=True, exist_ok=True)
        args = [exe, f"--app={url}", f"--user-data-dir={runtime_env.EDGE_PROFILE}",
                "--no-first-run", "--no-default-browser-check", "--disable-background-mode",
                "--window-size=1440,920"]
        try:
            return subprocess.Popen(args)
        except OSError as e:
            print(f"[desktop] could not start {exe}: {e}")
    webbrowser.open(url)
    return None


def runtime_ready():
    if not runtime_env.RUNTIME_MARKER.exists() and (runtime_env.INSTALL_ROOT / "python").exists():
        return False
    try:
        import waitress  # noqa: F401
        import flask  # noqa: F401
        return True
    except ImportError:
        return False


def run_setup():
    script = runtime_env.APP_ROOT / "desktop" / "setup_runtime.ps1"
    subprocess.Popen(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)],
                     creationflags=CREATE_NEW_CONSOLE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-window", action="store_true")
    ap.add_argument("--port", type=int, default=int(os.environ.get("MHDT_PORT", DEFAULT_PORT)))
    ap.add_argument("--stop", action="store_true")
    args = ap.parse_args()

    runtime_env.configure()
    log_file = runtime_env.LOG_DIR / "app.log"
    if sys.stdout is None or os.path.basename(sys.executable).lower() == "pythonw.exe":
        _redirect_output(log_file)

    port = args.port

    if args.stop:
        try:
            req = urllib.request.Request(f"http://{HOST}:{port}/__mhdt/shutdown", data=b"", method="POST")
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass
        return

    # Already running? just open another window.
    if _status(port):
        if not args.no_window:
            open_window(f"http://{HOST}:{port}/")
        return

    if not runtime_ready():
        _msgbox("The AI runtime is not installed yet (or is incomplete).\n\n"
                "A setup window will open now and download PyTorch + models for your GPU. "
                "Start the app again when it finishes.")
        run_setup()
        return

    # The app's identity (patient id, settings) lives in the browser profile for this exact origin,
    # so keep the port stable: wait for a previous instance to release it before falling back.
    for _ in range(40):
        if _port_free(port):
            break
        time.sleep(0.5)
    else:
        print(f"[desktop] port {port} busy, using a random port (browser storage will differ)", flush=True)
        port = _free_port()

    from desktop import server
    disp, srv = server.create(HOST, port, str(log_file))
    threading.Thread(target=srv.run, name="waitress", daemon=True).start()
    threading.Thread(target=disp.load_backend, name="backend-loader", daemon=True).start()
    url = f"http://{HOST}:{port}/"
    print(f"[desktop] Serving on {url}", flush=True)

    if args.no_window:
        try:
            while not disp.shutdown_requested.wait(1):
                pass
        except KeyboardInterrupt:
            pass
        srv.close()
        return

    proc = open_window(url)
    started = time.time()
    if proc is not None:
        proc.wait()
    # Window closed normally (process lived >5s) -> quit. Otherwise (handed off to an existing
    # browser / default browser) stay alive while the page keeps sending heartbeats.
    if proc is None or time.time() - started < 5:
        grace = 180
        deadline = time.time() + 90
        while not disp.shutdown_requested.is_set():
            time.sleep(2)
            hb = disp.last_heartbeat
            if hb == 0 and time.time() > deadline:
                break
            if hb and time.time() - hb > grace:
                break
    print("[desktop] Window closed, shutting down.", flush=True)
    try:
        srv.close()
    except Exception:
        pass
    os._exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        _msgbox("Mental Health Digital Twin failed to start.\n\n" + traceback.format_exc()[-1500:])
        raise
