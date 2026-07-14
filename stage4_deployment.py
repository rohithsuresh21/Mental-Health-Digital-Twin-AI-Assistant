import numpy as np
import pickle
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from data_validator import SafePipeline
from unified_pipeline import UnifiedJournalPipeline
from stage_4.config import PipelineConfig


class Stage4DeploymentPipeline:
    def __init__(
        self,
        model_path: str = "calibration/models/stage4_detectors.pkl",
        threshold_path: str = "calibration/models/stage4_threshold_engine.pkl",
    ):
        self.pipeline = UnifiedJournalPipeline()
        self.safe_pipeline = SafePipeline(self.pipeline)

        with open(model_path, "rb") as f:
            self.detectors = pickle.load(f)

        with open(threshold_path, "rb") as f:
            self.threshold_engine = pickle.load(f)

        sanitizer_path = str(Path(threshold_path).parent / "stage4_sanitizer.pkl")
        with open(sanitizer_path, "rb") as f:
            self.sanitizer = pickle.load(f)

        print(f"✓ Loaded pretrained detectors from {model_path}")
        print(f"✓ Loaded threshold engine and sanitizer")

    def process_user_entry(
        self,
        user_id: str,
        text: str,
        sleep_hours=None,
        sleep_quality=None,
        activity_level=None,
        music_mood_score=None,
    ) -> dict:
        result = self.safe_pipeline.process_entry_safe(
            user_id=user_id,
            text=text,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality,
            activity_level=activity_level,
            music_mood_score=music_mood_score,
        )

        if result.get("status") == "REJECTED":
            return {"status": "REJECTED", "reason": result.get("reason"), "user_id": user_id}

        z_vector = np.array(
            result["stage_2_output"]["z_scored_vector"], dtype=np.float64
        ).reshape(1, -1)

        scores = self._detect_anomalies(z_vector)
        return {"status": "OK", "user_id": user_id, "stage_1": result["stage_1"], "stage_4": scores}

    def _detect_anomalies(self, z_vector: np.ndarray) -> dict:
        X_clean = self.sanitizer.transform(z_vector)
        w = PipelineConfig.DETECTOR_WEIGHTS

        detector_scores = {
            "mahalanobis":      float(self.detectors["mahalanobis"].predict_score(X_clean)[0]),
            "copula":           float(self.detectors["copula"].predict_score(X_clean)[0]),
            "isolation_forest": float(self.detectors["isolation_forest"].predict_score(X_clean)[0]),
            "knn":              float(self.detectors["knn"].predict_score(X_clean)[0]),
        }

        overall_risk = (
            detector_scores["mahalanobis"]      * w["mahalanobis"] +
            detector_scores["copula"]           * w["copula"] +
            detector_scores["isolation_forest"] * w["isolation_forest"] +
            detector_scores["knn"]              * w["knn"]
        )

        is_anomaly_flags = {
            key: self.threshold_engine.eval_status(key, score)
            for key, score in detector_scores.items()
        }
        combined_flag = self.threshold_engine.eval_status("combined", overall_risk)

        return {
            "overall_risk_score": round(overall_risk, 4),
            "is_anomaly":         combined_flag,
            "detector_flags":      is_anomaly_flags,
            "detector_scores":     detector_scores,
        }