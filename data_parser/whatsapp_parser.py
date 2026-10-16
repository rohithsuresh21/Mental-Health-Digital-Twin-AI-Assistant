import re
from datetime import datetime

# Handles Android + iOS exports, 24h and 12h clocks (incl. the narrow no-break space WhatsApp
# puts before am/pm), optional seconds, '/', '-' or '.' date separators and [bracketed] stamps:
#   16/10/26, 9:15 pm - Name: msg        [16/10/2026, 21:15:02] Name: msg
_LINE = re.compile(
    r"^‎?\[?(?P<date>\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}),?\s+"
    r"(?P<time>\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)(?:[\s  ]*(?P<ampm>[AaPp]\.?\s?[Mm]\.?))?\]?"
    r"\s*(?:-|–)?\s*(?P<sender>[^:]+?):\s(?P<text>.*)$"
)
_SKIP = ("<media omitted>", "image omitted", "video omitted", "audio omitted", "sticker omitted",
         "gif omitted", "document omitted", "this message was deleted", "you deleted this message",
         "messages and calls are end-to-end encrypted", "null")


def _parse_ts(date_s, time_s, ampm):
    date_s = re.sub(r"[.\-]", "/", date_s)
    time_s = time_s.replace(".", ":")
    if ampm:
        ampm = re.sub(r"[^APap]", "", ampm).upper() + "M"
    has_sec = time_s.count(":") == 2
    tfmt = ("%I" if ampm else "%H") + ":%M" + (":%S" if has_sec else "") + (" %p" if ampm else "")
    tval = f"{time_s} {ampm}" if ampm else time_s
    for dfmt in ("%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(f"{date_s} {tval}", f"{dfmt} {tfmt}")
        except ValueError:
            continue
    return None


def parse_whatsapp(file_obj, display_name=None):
    """Return [{timestamp, sender, text}]. If display_name is given, keep only that sender
    (case-insensitive; also matches when one name contains the other, e.g. 'Rohith' vs 'Rohith M S')."""
    try:
        messages, current = [], None
        for line in file_obj:
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="ignore")
            line = line.strip().lstrip("﻿")
            if not line:
                continue
            m = _LINE.match(line)
            if m:
                ts = _parse_ts(m["date"], m["time"], m["ampm"])
                if ts is None:
                    current = None
                    continue
                text = m["text"].strip()
                if text.lower().strip("‎ ") in _SKIP or text.lower().endswith("omitted>"):
                    current = None
                    continue
                current = {"timestamp": ts, "sender": m["sender"].strip().strip("‎"), "text": text}
                messages.append(current)
            elif current:
                current["text"] += f" {line}"
        if display_name:
            messages = [m for m in messages if sender_matches(m["sender"], display_name)]
        return messages
    except Exception:
        return []


def sender_matches(sender: str, name: str) -> bool:
    a, b = (sender or "").strip().lower(), (name or "").strip().lower()
    if not a or not b:
        return False
    return a == b or a.startswith(b + " ") or b.startswith(a + " ")
