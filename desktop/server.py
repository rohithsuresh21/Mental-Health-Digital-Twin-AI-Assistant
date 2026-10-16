"""Single local server: serves the built React UI and the Flask API on one origin.

Routing mirrors the old vercel.json rewrites, so the frontend needs no changes:
    /api/explain  -> Flask /api/explain
    /api/<path>   -> Flask /<path>
    everything else -> static file from the frontend build, else index.html (SPA)
The heavy Flask app (models) loads in a background thread; meanwhile a loading
page is shown and /api returns 503.
"""
import json
import threading
import time
import traceback
from pathlib import Path

from desktop import runtime_env

MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8", ".map": "application/json", ".wasm": "application/wasm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4",
}

HEARTBEAT_JS = (
    "<script>(function(){function b(){try{fetch('/__mhdt/heartbeat',{method:'POST',keepalive:true})}catch(e){}}"
    "b();setInterval(b,5000);})();</script>"
)

LOADING_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Mental Health Digital Twin</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#07090E;
color:#e6e8ee;font-family:Segoe UI,system-ui,sans-serif}.c{text-align:center;max-width:560px;padding:24px}
.s{width:42px;height:42px;border:3px solid #2a3142;border-top-color:#5b8cff;border-radius:50%;
animation:r 1s linear infinite;margin:0 auto 22px}@keyframes r{to{transform:rotate(360deg)}}
h1{font-size:20px;font-weight:600;margin:0 0 8px}p{color:#9aa3b5;font-size:14px;margin:4px 0}
pre{text-align:left;white-space:pre-wrap;background:#121725;padding:12px;border-radius:8px;font-size:12px;
max-height:280px;overflow:auto;color:#ff9b9b}</style></head><body><div class="c" id="c"><div class="s"></div>
<h1>Starting your Digital Twin</h1><p id="m">Loading AI models&hellip;</p><p id="d"></p></div>
<script>
const t0=Date.now();
async function poll(){try{const r=await fetch('/__mhdt/status',{cache:'no-store'});const s=await r.json();
if(s.device){document.getElementById('d').textContent='Running on '+(s.gpu?('GPU: '+s.gpu):'CPU');}
if(s.ready){location.reload();return;}
if(s.error){document.getElementById('c').innerHTML='<h1>Backend failed to start</h1><p>Log: '+s.log+
'</p><pre></pre>';document.querySelector('pre').textContent=s.error;return;}
document.getElementById('m').textContent='Loading AI models\\u2026 '+Math.round((Date.now()-t0)/1000)+'s';
}catch(e){}setTimeout(poll,1000);}poll();
</script></body></html>"""


class Dispatcher:
    def __init__(self, dist_dir: Path, log_path: str = ""):
        self.dist = Path(dist_dir).resolve()
        self.backend = None
        self.error = None
        self.device = {}
        self.log_path = log_path
        self.last_heartbeat = 0.0
        self.shutdown_requested = threading.Event()
        self._index_cache = None

    # ---------- backend loading ----------
    def load_backend(self):
        try:
            t = time.time()
            print("[desktop] Importing backend (loading models)...", flush=True)
            try:
                import device_util
                self.device = device_util.describe()
                print(f"[desktop] Compute device: {self.device}", flush=True)
            except Exception:
                pass
            import app as backend_module
            flask_app = backend_module.app
            # Same-origin http://127.0.0.1 -> normal Lax, non-Secure session cookie
            flask_app.config["SESSION_COOKIE_SECURE"] = False
            flask_app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
            self.backend = flask_app
            print(f"[desktop] Backend ready in {time.time() - t:.1f}s", flush=True)
        except BaseException:
            self.error = traceback.format_exc()
            print("[desktop] Backend failed:\n" + self.error, flush=True)

    # ---------- helpers ----------
    @staticmethod
    def _send(start_response, status, body: bytes, ctype, extra=None):
        headers = [("Content-Type", ctype), ("Content-Length", str(len(body)))]
        if extra:
            headers += extra
        start_response(status, headers)
        return [body]

    def _json(self, start_response, obj, status="200 OK"):
        return self._send(start_response, status, json.dumps(obj).encode(), "application/json",
                          [("Cache-Control", "no-store")])

    def _index(self) -> bytes:
        if self._index_cache is None:
            p = self.dist / "index.html"
            if not p.exists():
                html = "<h1>Frontend build missing</h1><p>Run build_installer.ps1 (npm run build).</p>"
            else:
                html = p.read_text(encoding="utf-8")
            html = html.replace("</body>", HEARTBEAT_JS + "</body>") if "</body>" in html else html + HEARTBEAT_JS
            self._index_cache = html.encode("utf-8")
        return self._index_cache

    def _static(self, path: str):
        rel = path.lstrip("/")
        if not rel:
            return None
        try:
            f = (self.dist / rel).resolve()
            f.relative_to(self.dist)
        except (ValueError, OSError):
            return None
        if f.is_file():
            return f
        return None

    # ---------- WSGI ----------
    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "/") or "/"
        method = environ.get("REQUEST_METHOD", "GET")

        if path.startswith("/__mhdt/"):
            if path == "/__mhdt/status":
                if environ.get("HTTP_SEC_FETCH_MODE"):   # polled by the loading page (a browser)
                    self.last_heartbeat = time.time()
                return self._json(start_response, {
                    "app": "mhdt", "ready": self.backend is not None, "error": self.error,
                    "log": self.log_path, **self.device})
            if path == "/__mhdt/heartbeat":
                self.last_heartbeat = time.time()
                return self._send(start_response, "204 No Content", b"", "text/plain")
            if path == "/__mhdt/shutdown" and method == "POST":
                self.shutdown_requested.set()
                return self._json(start_response, {"ok": True})
            return self._send(start_response, "404 Not Found", b"not found", "text/plain")

        if path == "/api" or path.startswith("/api/"):
            if self.backend is None:
                msg = "Backend failed to start" if self.error else "AI models are still loading, try again in a moment"
                return self._json(start_response, {"error": msg}, "503 Service Unavailable")
            if path != "/api/explain":
                environ = dict(environ)
                environ["PATH_INFO"] = path[4:] or "/"
            return self.backend(environ, start_response)

        f = self._static(path)
        if f is not None and f.name != "index.html":
            body = f.read_bytes()
            cache = "public, max-age=31536000, immutable" if "/assets/" in path else "no-cache"
            return self._send(start_response, "200 OK", body,
                              MIME.get(f.suffix.lower(), "application/octet-stream"),
                              [("Cache-Control", cache)])

        if self.backend is None:
            return self._send(start_response, "200 OK", LOADING_HTML.encode(), "text/html; charset=utf-8",
                              [("Cache-Control", "no-store")])
        return self._send(start_response, "200 OK", self._index(), "text/html; charset=utf-8",
                          [("Cache-Control", "no-store")])


def create(host: str, port: int, log_path: str = ""):
    from waitress import create_server
    disp = Dispatcher(runtime_env.frontend_dir(), log_path)
    srv = create_server(disp, host=host, port=port, threads=8,
                        channel_timeout=900, max_request_body_size=64 * 1024 * 1024,
                        ident="mhdt")
    return disp, srv
