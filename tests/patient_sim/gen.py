"""Generate a realistic 30-day patient: daily journal + sliders + some voice notes,
plus WhatsApp (Android 12h), Telegram JSON and Reddit CSV exports covering the same month."""
import json, csv, os, random, datetime as dt
os.chdir(os.path.dirname(os.path.abspath(__file__)))
random.seed(7)
END = dt.date.today(); START = END - dt.timedelta(days=29)
days = [START + dt.timedelta(days=i) for i in range(30)]
good = ["Slept well and went for a morning run, feeling energetic.", "Productive day in the lab, finished my assignment early.",
        "Had dinner with friends, laughed a lot.", "Calm day, read a book and called home.", "Great workout, proud of my progress."]
mid  = ["Normal day, classes and a bit of coding.", "Bit tired but managed everything.", "Okay day, nothing special happened.",
        "Some stress about deadlines but it is fine.", "Quiet evening, watched a movie."]
bad  = ["Could not sleep, mind racing about exams.", "Feeling lonely and low, skipped meals.", "Anxious all day, could not focus at all.",
        "Everything feels heavy, stayed in bed most of the day.", "Irritable and exhausted, argued with my roommate."]
rows = []
for i, d in enumerate(days):
    phase = "good" if i < 12 else ("mid" if i < 20 else "bad")    # gradual decline in the last 10 days
    pool = {"good": good, "mid": mid, "bad": bad}[phase]
    base = {"good": (7.5, .8, .7, .75), "mid": (6.5, .6, .5, .55), "bad": (4.5, .3, .2, .25)}[phase]
    rows.append(dict(date=d.isoformat(), text=random.choice(pool),
        sleep_hours=round(base[0] + random.uniform(-.7, .7), 1), sleep_quality=round(min(1, max(0, base[1] + random.uniform(-.1, .1))), 2),
        activity_level=round(min(1, max(0, base[2] + random.uniform(-.1, .1))), 2), music_mood_score=round(min(1, max(0, base[3] + random.uniform(-.1, .1))), 2),
        audio=(i % 7 == 3), phase=phase))
json.dump(rows, open("days.json", "w"), indent=1)
# WhatsApp Android export, 12-hour clock with narrow no-break space before am/pm (current WhatsApp format)
wa = []
for i, r in enumerate(rows):
    d = dt.date.fromisoformat(r["date"])
    if i % 2 == 0:
        msg = {"good": "had such a good day today", "mid": "meh, regular day", "bad": "honestly not doing great, cant sleep"}[r["phase"]]
        wa.append(f"{d.day:02d}/{d.month:02d}/{d.year % 100:02d}, 9:{10+i%40:02d} pm - Rohith M S: {msg}")
        wa.append(f"{d.day:02d}/{d.month:02d}/{d.year % 100:02d}, 9:{11+i%40:02d} pm - Arjun: ok bro")
open("WhatsApp Chat with Arjun.txt", "w", encoding="utf-8").write("\n".join(wa))
# Telegram Desktop JSON export
tg = {"name": "Family", "type": "personal_chat", "messages": []}
for i, r in enumerate(rows):
    if i % 3 == 1:
        tg["messages"].append({"id": i, "type": "message", "date": f"{r['date']}T20:15:00", "from": "Rohith", "text": f"Update: {r['text'].lower()}"})
        tg["messages"].append({"id": 1000+i, "type": "message", "date": f"{r['date']}T20:20:00", "from": "Amma", "text": "take care kanna"})
json.dump(tg, open("result.json", "w"))
# Reddit official data export: comments.csv
with open("comments.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["id", "permalink", "date", "ip", "subreddit", "gildings", "link", "parent", "body", "media"])
    for i, r in enumerate(rows):
        if i % 5 == 2:
            w.writerow([f"c{i}", "/r/x", f"{r['date']} 18:30:00 UTC", "", "college", 0, "", "", {"good": "Loving the semester so far!", "mid": "Anyone else find midterms tiring?", "bad": "I feel like I'm falling behind and can't keep up."}[r["phase"]], ""])
print(len(rows), "days;", len(wa)//2, "whatsapp msgs;", len(tg["messages"])//2, "telegram;", sum(1 for i in range(30) if i%5==2), "reddit")
