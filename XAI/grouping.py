
BASE_FEATURES = {

    # ── GoEmotions (28 emotions) ──────────────────────────────────────────
    "emotion_admiration":    {"group": "Emotional State", "concept": "Admiration",     "show": True},
    "emotion_amusement":     {"group": "Emotional State", "concept": "Amusement",      "show": True},
    "emotion_anger":         {"group": "Emotional State", "concept": "Anger",          "show": True},
    "emotion_annoyance":     {"group": "Emotional State", "concept": "Annoyance",      "show": True},
    "emotion_approval":      {"group": "Emotional State", "concept": "Approval",        "show": True},
    "emotion_caring":        {"group": "Emotional State", "concept": "Caring",          "show": True},
    "emotion_confusion":     {"group": "Emotional State", "concept": "Confusion",      "show": True},
    "emotion_curiosity":     {"group": "Emotional State", "concept": "Curiosity",       "show": True},
    "emotion_desire":        {"group": "Emotional State", "concept": "Desire",         "show": True},
    "emotion_disappointment":{"group": "Emotional State", "concept": "Disappointment", "show": True},
    "emotion_disapproval":   {"group": "Emotional State", "concept": "Disapproval",    "show": True},
    "emotion_disgust":       {"group": "Emotional State", "concept": "Disgust",        "show": True},
    "emotion_embarrassment": {"group": "Emotional State", "concept": "Embarrassment",   "show": True},
    "emotion_excitement":    {"group": "Emotional State", "concept": "Excitement",      "show": True},
    "emotion_fear":          {"group": "Emotional State", "concept": "Fear / Anxiety", "show": True},
    "emotion_gratitude":     {"group": "Emotional State", "concept": "Gratitude",       "show": True},
    "emotion_grief":         {"group": "Emotional State", "concept": "Grief",          "show": True},
    "emotion_joy":           {"group": "Emotional State", "concept": "Joy",            "show": True},
    "emotion_love":          {"group": "Emotional State", "concept": "Love",           "show": True},
    "emotion_nervousness":   {"group": "Emotional State", "concept": "Nervousness",    "show": True},
    "emotion_optimism":      {"group": "Emotional State", "concept": "Optimism",       "show": True},
    "emotion_pride":         {"group": "Emotional State", "concept": "Pride",           "show": True},
    "emotion_realization":   {"group": "Emotional State", "concept": "Realisation",     "show": True},
    "emotion_relief":        {"group": "Emotional State", "concept": "Relief",         "show": True},
    "emotion_remorse":       {"group": "Emotional State", "concept": "Remorse",        "show": True},
    "emotion_sadness":       {"group": "Emotional State", "concept": "Sadness",        "show": True},
    "emotion_surprise":      {"group": "Emotional State", "concept": "Surprise",        "show": True},
    "emotion_neutral":       {"group": "Emotional State", "concept": "Emotional Flatness", "show": True},

    # ── VADER sentiment ───────────────────────────────────────────────────
    "compound":                  {"group": "Sentiment", "concept": "Overall Sentiment",          "show": True},
    "positive":                  {"group": "Sentiment", "concept": "Positive Tone",              "show": True},
    "negative":                  {"group": "Sentiment", "concept": "Negative Tone",              "show": True},
    "neutral":                   {"group": "Sentiment", "concept": "Neutral Tone",               "show": False},
    "compound_abs":              {"group": "Sentiment", "concept": "Emotional Intensity",        "show": True},
    "positive_negative_ratio":   {"group": "Sentiment", "concept": "Positive vs Negative Balance","show": True},
    "sentiment_magnitude":       {"group": "Sentiment", "concept": "Sentiment Strength",         "show": True},

    # ── lexical diversity ─────────────────────────────────────────────────
    "type_token_ratio":          {"group": "Writing Style", "concept": "Vocabulary Richness (TTR)",    "show": True},
    "unique_word_ratio":         {"group": "Writing Style", "concept": "Vocabulary Uniqueness",        "show": True},

    # ── readability ───────────────────────────────────────────────────────
    "flesch_reading_ease":       {"group": "Writing Style", "concept": "Reading Ease",                 "show": True},
    "flesch_kincaid_grade":      {"group": "Writing Style", "concept": "Writing Complexity (Grade)",   "show": True},
    "automated_readability_index":{"group":"Writing Style", "concept": "Readability (ARI)",            "show": False},

    # ── pronoun usage ─────────────────────────────────────────────────────
    "first_person_ratio":        {"group": "Cognitive Patterns", "concept": "Self-Focus (I/me/my)",    "show": True},
    "first_person_count":        {"group": "Cognitive Patterns", "concept": "Self-Reference Count",    "show": False},

    # ── length features ───────────────────────────────────────────────────
    "word_count":                {"group": "Writing Style", "concept": "Entry Length",                 "show": True},
    "sentence_count":            {"group": "Writing Style", "concept": "Number of Sentences",          "show": False},
    "average_sentence_length":   {"group": "Writing Style", "concept": "Sentence Length",              "show": True},

    # ── punctuation patterns ──────────────────────────────────────────────
    "question_ratio":            {"group": "Cognitive Patterns", "concept": "Question Usage (? marks)",    "show": True},
    "exclamation_ratio":         {"group": "Cognitive Patterns", "concept": "Emotional Arousal (! marks)","show": True},
    "ellipsis_ratio":            {"group": "Cognitive Patterns", "concept": "Ellipsis Usage (...)", "show": True},
    "capitalization_ratio":      {"group": "Cognitive Patterns", "concept": "Emphasis (CAPS)",         "show": False},

    # ── temporal metadata ─────────────────────────────────────────────────
    "hour_of_day":               {"group": "Behavioural Patterns", "concept": "Time of Writing",       "show": True},
    "day_of_week":               {"group": "Behavioural Patterns", "concept": "Day of Week",           "show": False},
    "days_since_previous_entry": {"group": "Behavioural Patterns", "concept": "Gap Since Last Entry",  "show": True},
}

# ── statistic descriptions ────────────────────────────────────────────────────
# how to translate the 5 statistics into plain English for each feature concept

STAT_DESCRIPTIONS = {
    "mean":  "Average {concept} over recent entries",
    "std":   "Variation in {concept} over recent entries",
    "min":   "Lowest observed {concept}",
    "max":   "Highest observed {concept}",
    "delta": "Recent change in {concept}",
}

# ── features to never show regardless ────────────────────────────────────────
ALWAYS_EXCLUDE = {
    # health features — not in DAIC-WOZ training data
    "sleep_hours", "sleep_quality", "activity_level", "music_mood",
    # audio/acoustic — not in DAIC-WOZ training data  
    "speech_rate", "pause_ratio", "avg_pause_length",
    "pitch_mean", "pitch_std", "rms_mean", "rms_std",
    "wav2vec2_angry", "wav2vec2_happy", "wav2vec2_neutral", "wav2vec2_sad",
    # masks — binary flags, not meaningful to display
    "health_mask_sleep", "health_mask_quality", "health_mask_activity", "health_mask_music",
    "audio_mask",
}

# ── group ordering for display ────────────────────────────────────────────────
GROUP_ORDER = [
    "Emotional State",
    "Sentiment",
    "Cognitive Patterns",
    "Writing Style",
    "Behavioural Patterns",
]

def parse_feature_name(full_name: str) -> tuple[str, str] | tuple[None, None]:
    """
    Parses 'mean_emotion_sadness' → ('mean', 'emotion_sadness')
    Parses 'max_vader_compound'   → ('max',  'compound')
    Returns (None, None) if not parseable.
    """
    stats = {"mean", "std", "min", "max", "delta"}
    parts = full_name.split("_", 1)
    if len(parts) != 2:
        return None, None
    stat, base = parts
    if stat not in stats:
        return None, None
    return stat, base

def get_feature_info(full_name: str) -> dict | None:
    """
    Given a full feature name like 'mean_emotion_sadness',
    returns all info needed for display. Returns None if should be hidden.
    """
    stat, base = parse_feature_name(full_name)
    if stat is None or base is None:
        return None

    # check exclusion list
    for excluded in ALWAYS_EXCLUDE:
        if excluded in base:
            return None

    # look up base feature
    info = BASE_FEATURES.get(base)
    if info is None:
        return None

    if not info.get("show", True):
        return None

    concept = info["concept"]
    description = STAT_DESCRIPTIONS.get(stat, f"{stat} of {concept}").format(concept=concept)

    return {
        "full_name":   full_name,
        "stat":        stat,
        "base":        base,
        "concept":     concept,
        "group":       info["group"],
        "description": description,
        "show":        True,
    }
