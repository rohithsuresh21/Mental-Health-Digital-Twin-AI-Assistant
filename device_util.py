"""Picks the compute device for all ML models (user's GPU when available).

Override with env MHDT_DEVICE=cpu|cuda.
"""
import os

_DEVICE = None


def get_device() -> str:
    global _DEVICE
    if _DEVICE is not None:
        return _DEVICE
    forced = os.environ.get("MHDT_DEVICE", "").strip().lower()
    try:
        import torch
        if forced == "cpu":
            _DEVICE = "cpu"
        elif torch.cuda.is_available():
            _DEVICE = "cuda"
        else:
            _DEVICE = "cpu"
    except Exception:
        _DEVICE = "cpu"
    return _DEVICE


def hf_device() -> int:
    """Device index for transformers.pipeline (0 = first GPU, -1 = CPU)."""
    return 0 if get_device() == "cuda" else -1


def describe() -> dict:
    info = {"device": get_device(), "gpu": None, "torch": None, "cuda": None}
    try:
        import torch
        info["torch"] = torch.__version__
        info["cuda"] = torch.version.cuda
        if info["device"] == "cuda":
            info["gpu"] = torch.cuda.get_device_name(0)
    except Exception:
        pass
    return info
