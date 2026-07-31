import json
from datetime import datetime, timezone
def parse_reddit(post_file_obj, comment_file_obj):
    try:
        messages = []
        def is_valid_text(text):
            if not text: return False
            cleaned = text.strip().lower()
            return cleaned not in ["[removed]", "[deleted]", ""]
        if post_file_obj:
            posts = json.load(post_file_obj)
            for p in posts:
                title = p.get("title", "").strip()
                selftext = p.get("selftext", "").strip()
                text_parts = []
                if is_valid_text(title): text_parts.append(title)
                if is_valid_text(selftext): text_parts.append(selftext)
                if text_parts:
                    messages.append({
                        "timestamp": datetime.fromtimestamp(p.get("created_utc"), tz=timezone.utc),
                        "text": "\n".join(text_parts),
                        "sender": p.get("author", "Unknown")
                    })
        if comment_file_obj:
            comments = json.load(comment_file_obj)
            for c in comments:
                body = c.get("body", "").strip()
                if is_valid_text(body):
                    messages.append({
                        "timestamp": datetime.fromtimestamp(c.get("created_utc"), tz=timezone.utc),
                        "text": body,
                        "sender": c.get("author", "Unknown")
                    })
        messages.sort(key=lambda x: x["timestamp"])
        return messages
    except Exception:
        return []