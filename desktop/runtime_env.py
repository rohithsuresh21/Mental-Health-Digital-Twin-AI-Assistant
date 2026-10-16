"""Environment setup shared by the launcher, server and model prefetcher.

Installed layout (per-user, writable):
    <install>/python/          embedded CPython 3.12 + site-packages
    <install>/app/             this repository (app.py, Stage_*, desktop/, frontend/)
    <install>/models_cache/    HF / Whisper / NLTK caches (filled at install time)
    <install>/logs/
Dev layout (running from the repo with your venv):
    caches go to <repo>/.models_cache, logs to <repo>/.desktop_logs
"""
import os
import secrets
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
_INSTALLED = (APP_ROOT.parent / "python" / "python.exe").exists() and APP_ROOT.name == "app"
INSTALL_ROOT = APP_ROOT.parent if _INSTALLED else APP_ROOT

if os.environ.get("MHDT_HOME"):
    HOME = Path(os.environ["MHDT_HOME"])
    CACHE_DIR = HOME / "models_cache"
    LOG_DIR = HOME / "logs"
elif _INSTALLED:
    CACHE_DIR = INSTALL_ROOT / "models_cache"
    LOG_DIR = INSTALL_ROOT / "logs"
else:
    CACHE_DIR = APP_ROOT / ".models_cache"
    LOG_DIR = APP_ROOT / ".desktop_logs"

DATA_DIR = APP_ROOT / "data"
PREFETCH_MARKER = CACHE_DIR / ".prefetched"
RUNTIME_MARKER = INSTALL_ROOT / "runtime_ready.json"
EDGE_PROFILE = INSTALL_ROOT / "edge-profile" if _INSTALLED else APP_ROOT / ".desktop_logs" / "edge-profile"


def frontend_dir() -> Path:
    for p in (APP_ROOT / "frontend", APP_ROOT / "User Interface" / "dist"):
        if (p / "index.html").exists():
            return p
    return APP_ROOT / "frontend"


def _secret_key() -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    f = DATA_DIR / ".secret_key"
    try:
        if f.exists():
            k = f.read_text().strip()
            if k:
                return k
        k = secrets.token_hex(32)
        f.write_text(k)
        return k
    except OSError:
        return secrets.token_hex(32)


def configure(allow_network: bool = False) -> None:
    os.chdir(APP_ROOT)
    if str(APP_ROOT) not in sys.path:
        sys.path.insert(0, str(APP_ROOT))
    for d in (CACHE_DIR, LOG_DIR, DATA_DIR):
        d.mkdir(parents=True, exist_ok=True)

    env = os.environ
    env.setdefault("HF_HOME", str(CACHE_DIR / "huggingface"))
    env.setdefault("XDG_CACHE_HOME", str(CACHE_DIR))          # whisper -> <cache>/whisper
    env.setdefault("TORCH_HOME", str(CACHE_DIR / "torch"))
    env.setdefault("NLTK_DATA", str(CACHE_DIR / "nltk_data"))
    env.setdefault("MPLBACKEND", "Agg")
    env.setdefault("TOKENIZERS_PARALLELISM", "false")
    env.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env["MHDT_DESKTOP"] = "1"
    env.setdefault("FLASK_SECRET_KEY", _secret_key())

    if not allow_network and PREFETCH_MARKER.exists():
        env.setdefault("HF_HUB_OFFLINE", "1")
        env.setdefault("TRANSFORMERS_OFFLINE", "1")

    try:
        import nltk  # noqa: F401
        nltk_dir = env["NLTK_DATA"]
        if nltk_dir not in nltk.data.path:
            nltk.data.path.insert(0, nltk_dir)
    except Exception:
        pass
