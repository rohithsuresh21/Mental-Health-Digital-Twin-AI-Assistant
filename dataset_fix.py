import pandas as pd
import numpy as np

df = pd.read_csv("journal_dataset_200_v2.csv")

# Forward fill then add small noise so values don't look identical
for col in ["sleep_hours", "activity_level", "music_mood_score"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")
    df[col] = df[col].ffill()
    
    # Add small random noise to avoid flat lines
    mask = df[col].notna()
    noise = np.random.normal(0, 0.05, size=mask.sum())
    df.loc[mask, col] = np.clip(df.loc[mask, col] + noise, 0.0, 1.0)

# Round to 2 decimal places
df["sleep_hours"] = df["sleep_hours"].round(1)
df["activity_level"] = df["activity_level"].round(2)
df["music_mood_score"] = df["music_mood_score"].round(2)

df.to_csv("journal_dataset_200_fixed.csv", index=False)
print("Done")