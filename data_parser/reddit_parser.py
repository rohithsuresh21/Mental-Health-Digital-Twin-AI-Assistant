import csv
import io
import json
from datetime import datetime, timezone


def _valid(text):
    return bool(text) and text.strip().lower() not in ("[removed]", "[deleted]", "")


def _parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)) or str(value).replace(".", "", 1).isdigit():
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    s = str(value).strip().replace(" UTC", "").replace("Z", "")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _load_rows(file_obj):
    """Reddit data comes either as JSON (API/Pushshift dumps) or as the official
    'Request your data' CSV export (posts.csv / comments.csv)."""
    raw = file_obj.read()
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8-sig", errors="ignore")
    raw = raw.strip()
    if not raw:
        return []
    if raw[0] in "[{":
        data = json.loads(raw)
        if isinstance(data, dict):
            data = data.get("data", {}).get("children", data.get("posts", data.get("comments", [data])))
            data = [d.get("data", d) for d in data]
        return data
    return list(csv.DictReader(io.StringIO(raw)))


def parse_reddit(post_file_obj, comment_file_obj):
    try:
        messages = []
        for kind, obj in (("post", post_file_obj), ("comment", comment_file_obj)):
            if not obj:
                continue
            for r in _load_rows(obj):
                if kind == "post":
                    parts = [p.strip() for p in (r.get("title", ""), r.get("selftext", "") or r.get("body", "")) if _valid(p)]
                    text = "\n".join(parts)
                else:
                    text = (r.get("body") or "").strip()
                ts = _parse_date(r.get("created_utc") or r.get("date") or r.get("created"))
                if _valid(text) and ts:
                    messages.append({"timestamp": ts, "text": text, "sender": r.get("author") or "me"})
        messages.sort(key=lambda x: x["timestamp"])
        return messages
    except Exception:
        return []
