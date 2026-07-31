import json
from datetime import datetime, timezone
def parse_telegram(file_obj):
    try:
        messages = []
        data = json.load(file_obj)
        chat_name = data.get("name", "Unknown Chat")
        raw_messages = data.get("messages", [])
        for msg in raw_messages:
            if msg.get("type") == "service":
                continue
            raw_text = msg.get("text", "")
            final_text = ""
            if isinstance(raw_text, list):
                extracted_parts = []
                for item in raw_text:
                    if isinstance(item, str):
                        extracted_parts.append(item)
                    elif isinstance(item, dict) and "text" in item:
                        extracted_parts.append(item["text"])
                final_text = "".join(extracted_parts).strip()
            elif isinstance(raw_text, str):
                final_text = raw_text.strip()
            if not final_text:
                continue
            sender = msg.get("from", chat_name)
            date_str = msg.get("date")
            timestamp = datetime.fromisoformat(date_str)
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            messages.append({
                "timestamp": timestamp,
                "text": final_text,
                "sender": sender
            })
        return messages
    except Exception:
        return []