import numpy as np
from sklearn.ensemble import IsolationForest

class ProductionIsolationForestDetector:
    def __init__(self, n_estimators: int = 100, contamination: float = 0.05, random_state: int =  42) -> None:
        self.detector = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
            n_jobs=-1
        )
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray) -> "ProductionIsolationForestDetector":
        X_arr = np.asarray(X, dtype=np.float64)
        self.detector.fit(X_arr)
        raw_train_scores = -self.detector.score_samples(X_arr)
        self.train_scores_ = np.sort(raw_train_scores)
        self.is_fitted = True
        return self
    
    def predict_score(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Isolation Forest not fitted. Call fit() first.")
        X_arr = np.asarray(X, dtype=np.float64)
        raw_decision_scores = -self.detector.score_samples(X_arr)
        n_train = len(self.train_scores_)
        ranks = np.searchsorted(self.train_scores_, raw_decision_scores, side="right")
        normalized = (ranks + 0.5) / (n_train + 1)
        return np.clip(normalized, 0.001, 0.999)