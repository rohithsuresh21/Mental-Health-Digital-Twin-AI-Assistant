"""Downloads every model the backend needs into <install>/models_cache so the app runs offline.
Run once at install time by setup_runtime.ps1 (safe to re-run)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from desktop import runtime_env  # noqa: E402

runtime_env.configure(allow_network=True)
os.environ.pop("HF_HUB_OFFLINE", None)
os.environ.pop("TRANSFORMERS_OFFLINE", None)


def step(msg):
    print(f"  -> {msg}", flush=True)


def main():
    import nltk
    step("NLTK punkt_tab")
    nltk.download("punkt_tab", download_dir=os.environ["NLTK_DATA"], quiet=True)

    from transformers import pipeline
    step("Text emotion model (SamLowe/roberta-base-go_emotions)")
    pipeline(task="text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None, device=-1)

    step("Speech emotion model (superb/wav2vec2-base-superb-er)")
    pipeline(task="audio-classification", model="superb/wav2vec2-base-superb-er", top_k=None, device=-1)

    from sentence_transformers import SentenceTransformer
    step("Sentence embeddings (all-MiniLM-L6-v2)")
    SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")

    import whisper
    step("Whisper base")
    whisper.load_model("base", device="cpu", download_root=str(runtime_env.CACHE_DIR / "whisper"))

    runtime_env.PREFETCH_MARKER.write_text("ok")
    print("  All models cached in", runtime_env.CACHE_DIR, flush=True)


if __name__ == "__main__":
    main()
