BASE_FEATURES = {
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
    "vader_compound":        {"group": "Sentiment", "concept": "Overall Sentiment",          "show": True},
    "vader_pos":             {"group": "Sentiment", "concept": "Positive Tone",              "show": True},
    "vader_neg":             {"group": "Sentiment", "concept": "Negative Tone",              "show": True},
    "vader_neu":             {"group": "Sentiment", "concept": "Neutral Tone",               "show": False},
    "vader_min_compound":    {"group": "Sentiment", "concept": "Lowest Sentiment",           "show": True},
    "vader_max_compound":    {"group": "Sentiment", "concept": "Highest Sentiment",          "show": True},
    "vader_std_compound":    {"group": "Sentiment", "concept": "Sentiment Variability",      "show": True},
    "ttr":                   {"group": "Writing Style", "concept": "Vocabulary Richness (TTR)",    "show": True},
    "mtld":                  {"group": "Writing Style", "concept": "Lexical Diversity (MTLD)",     "show": True},
    "readability_fre":       {"group": "Writing Style", "concept": "Reading Ease",                 "show": True},
    "readability_fkgl":      {"group": "Writing Style", "concept": "Writing Complexity (Grade)",   "show": True},
    "readability_ari":       {"group": "Writing Style", "concept": "Readability (ARI)",            "show": False},
    "first_person_singular": {"group": "Cognitive Patterns", "concept": "Self-Focus (I/me/my)",    "show": True},
    "first_person_plural":   {"group": "Cognitive Patterns", "concept": "Self-Reference Count",    "show": False},
    "word_count":            {"group": "Writing Style", "concept": "Entry Length",                 "show": True},
    "sentence_count":        {"group": "Writing Style", "concept": "Number of Sentences",          "show": False},
    "avg_sentence_length":   {"group": "Writing Style", "concept": "Sentence Length",              "show": True},
    "question_ratio":        {"group": "Cognitive Patterns", "concept": "Question Usage (? marks)",    "show": True},
    "exclamation_ratio":     {"group": "Cognitive Patterns", "concept": "Emotional Arousal (! marks)","show": True},
    "ellipsis_ratio":        {"group": "Cognitive Patterns", "concept": "Ellipsis Usage (...)", "show": True},
    "caps_ratio":            {"group": "Cognitive Patterns", "concept": "Emphasis (CAPS)",         "show": False},
    "hour_sin":              {"group": "Behavioural Patterns", "concept": "Time of Writing",       "show": True},
    "hour_cos":              {"group": "Behavioural Patterns", "concept": "Day of Week",           "show": False},
    "days_gap":              {"group": "Behavioural Patterns", "concept": "Gap Since Last Entry",  "show": True},
}
STAT_DESCRIPTIONS = {
    "mean":  "Average {concept} over recent entries",
    "std":   "Variation in {concept} over recent entries",
    "min":   "Lowest observed {concept}",
    "max":   "Highest observed {concept}",
    "delta": "Recent change in {concept}",
}
ALWAYS_EXCLUDE = {
    "sleep_hours", "sleep_quality", "activity_level", "music_mood",
    "mask_sleep", "mask_sleep_quality", "mask_activity", "mask_music",
    "audio_speech_rate", "audio_pause_ratio", "audio_avg_pause",
    "audio_pitch_mean", "audio_pitch_std", "audio_rms_mean", "audio_rms_std",
    "audio_emotion_angry", "audio_emotion_happy", "audio_emotion_neutral", "audio_emotion_sad",
    "audio_mask",
}
GROUP_ORDER = [
    "Emotional State",
    "Sentiment",
    "Cognitive Patterns",
    "Writing Style",
    "Behavioural Patterns",
]
def parse_feature_name(full_name: str) -> tuple[str, str] | tuple[None, None]:

    stats = {"mean", "std", "min", "max", "delta"}
    parts = full_name.split("_", 1)
    if len(parts) != 2:
        return None, None
    stat, base = parts
    if stat not in stats:
        return None, None
    return stat, base
def get_feature_info(full_name: str) -> dict | None:

    stat, base = parse_feature_name(full_name)
    if stat is None or base is None:
        return None
    for excluded in ALWAYS_EXCLUDE:
        if excluded in base:
            return None
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