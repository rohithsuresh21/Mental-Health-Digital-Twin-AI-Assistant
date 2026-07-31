import pandas as pd
import numpy as np
from datetime import timedelta
def generate_labeled_windows(phq_df):
    term_start = pd.Timestamp("2013-03-27").date()
    window = []
    for _, row in phq_df.iterrows():
        uid = row["uid"]
        label = row["label"]
        if row["type"] == "pre":
            end_date = term_start + timedelta(days=14)
        else:
            end_date = term_start + timedelta(days=69)
        window.append({
            "uid":uid,
            "end_date":end_date,
            "label":label
        })
    return window
def generate_ordinal_label(window_array):
    baseline = np.nanmean(window_array[:5], axis=0)
    end_state = np.nanmean(window_array[-5:], axis=0)
    deviation = end_state - baseline
    dist = np.linalg.norm(deviation) / (np.nanstd(window_array) + 1e-8)
    if dist < 1.0:
        return 0
    elif dist < 2.0:
        return 1
    elif dist < 3.0:
        return 2
    else:
        return 3