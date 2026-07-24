import re
from datetime import datetime

def parse_whatsapp(file_obj, display_name=None):
    try:
        messages = []
        pattern = re.compile(
            r"^(?:\[)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*-\s*([^:]+):\s*(.+)$|"
            r"^\[(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.+)$"
        )
        current_msg = None

        for line in file_obj:
            if isinstance(line, bytes):
                line = line.decode('utf-8', errors='ignore')
            line = line.strip()
            
            if not line:
                continue

            if "<Media omitted>" in line or "image omitted" in line:
                current_msg = None
                continue

            match = pattern.match(line)
            if match:
                groups = match.groups()
                if groups[0]:
                    date_str, time_str, sender, text = groups[0], groups[1], groups[2], groups[3]
                else:
                    date_str, time_str, sender, text = groups[4], groups[5], groups[6], groups[7]

                sender = sender.strip()
                dt_str = f"{date_str} {time_str}"
                
                timestamp = None
                formats = ("%d/%m/%Y %H:%M", "%d/%m/%y %H:%M", "%d-%m-%Y %H:%M", "%d-%m-%y %H:%M", "%m/%d/%Y %H:%M", "%m/%d/%y %H:%M")
                for fmt in formats:
                    try:
                        timestamp = datetime.strptime(dt_str, fmt)
                        break
                    except ValueError:
                        continue
                
                if not timestamp:
                    continue 
                current_msg = {
                    "timestamp": timestamp,
                    "sender": sender,
                    "text": text.strip()
                }
                messages.append(current_msg)
            else:

                if current_msg:
                    current_msg["text"] += f" {line}"

        if display_name:
            messages = [m for m in messages if m["sender"].lower() == display_name.lower()]

        return messages
    except Exception:
        return []