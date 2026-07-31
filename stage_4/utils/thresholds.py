import numpy as np
from collections import deque
from typing import Dict
class StaticPercentileEngine:
    def __init__(self, target_percentile: float = 95.0) -> None:
        self.target_percentile: float = target_percentile
        self.thresholds: Dict[str, float] = {}
        self.is_fitted: bool = False
    def fit(self, scored_dictionary: Dict[str, np.ndarray]) -> "StaticPercentileEngine":
        for key, scores in scored_dictionary.items():
            self.thresholds[key] = float(np.percentile(scores, self.target_percentile))
        self.is_fitted = True
        return self
    def eval_status(self, key: str, score: float) -> bool:
        if not self.is_fitted:
            return False
        return bool(score >= self.thresholds.get(key, float("inf")))
class AdaptivePercentileEngine:

    def __init__(
        self,
        target_percentile: float = 95.0,
        window_size: int = 20,
        adaptation_rate: float = 0.2,
        anomaly_adaptation_scale: float = 0.2,
        min_samples: int = 8,
    ) -> None:
        self.target_percentile: float = target_percentile
        self.window_size: int = window_size
        self.adaptation_rate: float = adaptation_rate
        self.anomaly_adaptation_scale: float = anomaly_adaptation_scale
        self.min_samples: int = min_samples
        self.thresholds: Dict[str, float] = {}
        self.buffers: Dict[str, deque] = {}
        self.is_fitted: bool = False
    def fit(self, scored_dictionary: Dict[str, np.ndarray]) -> "AdaptivePercentileEngine":
        for key, scores in scored_dictionary.items():
            scores = np.asarray(scores, dtype=float)
            self.thresholds[key] = float(np.percentile(scores, self.target_percentile))
            self.buffers[key] = deque(list(scores)[-self.window_size:], maxlen=self.window_size)
        self.is_fitted = True
        return self
    def update(self, key: str, score: float) -> None:
        buffer = self.buffers.get(key)
        if buffer is None or not self.is_fitted:
            return
        threshold = self.thresholds.get(key)
        if threshold is None:
            return
        buffer.append(score)
        if len(buffer) < max(self.min_samples, 5):
            return
        new_threshold = float(np.percentile(buffer, self.target_percentile))
        if score >= threshold:
            rate = self.adaptation_rate * self.anomaly_adaptation_scale
        else:
            rate = self.adaptation_rate
        self.thresholds[key] = rate * new_threshold + (1.0 - rate) * threshold
    def eval_status(self, key: str, score: float) -> bool:
        if not self.is_fitted:
            return False
        return bool(score >= self.thresholds.get(key, float("inf")))