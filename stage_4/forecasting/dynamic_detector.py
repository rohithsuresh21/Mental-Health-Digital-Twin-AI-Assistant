import numpy as np
import pickle
import os
from typing import List
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor

class DynamicTrajectoryForecastingEngine:

    def __init__(self, window_size: int = 30, max_horizon: int = 7):
        self.window_size = window_size
        self.max_horizon = max_horizon
        self.n_features: int = 0 
        self.model = MultiOutputRegressor(
            GradientBoostingRegressor(
                n_estimators = 100,
                learning_rate=0.05,
                max_depth = 4,
                random_state=42
            )
        )
        self.is_fitted: bool = False

    def transform_history_to_sequences(self, continuous_history: np.ndarray):

        arr = np.asarray(continuous_history, dtype= np.float64)

        if arr.ndim == 1:
            arr = arr.reshape(-1,1)
        
        if arr.ndim != 2:
            raise ValueError(f"Expected 1D or 2D array, got ndim={arr.ndim}")

        n_days, n_features = arr.shape
        total_window = self.window_size + self.max_horizon

        if n_days < total_window:
            raise ValueError(
                f"Insufficient history ({n_days} days). "
                f"Requires minimum {total_window} days."
            )

        n_samples = n_days - total_window + 1
        X_seq, Y_seq = [], []

        for i in range(n_samples):
            window_input = arr[i : i + self.window_size]      
            window_target = arr[i + self.window_size : i + total_window, 0]  
            X_seq.append(window_input.flatten())                
            Y_seq.append(window_target)                        

        return np.array(X_seq), np.array(Y_seq)

    def fit(self, continuous_history: np.ndarray):
        X_train, Y_train = self.transform_history_to_sequences(continuous_history)
        self.n_features = X_train.shape[1] // self.window_size
        self.model.fit(X_train, Y_train)
        self.is_fitted = True
        return self


    def predict_lookahead(self, recent_data: np.ndarray, n_days_ahead: int) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Must fit before Predict!")

        arr = np.asarray(recent_data, dtype=np.float64)
        if arr.ndim == 1:
            arr = arr.reshape(-1, 1)

        expected_cols = self.n_features if self.n_features > 0 else 1
        if arr.shape != (self.window_size, expected_cols):
            raise ValueError(
                f"Expected ({self.window_size}, {expected_cols}), got {arr.shape}"
            )

        input_vector = arr.flatten().reshape(1, -1)
        full_prediction = self.model.predict(input_vector)
        return np.clip(full_prediction.ravel()[:n_days_ahead], 0.0, 1.0)
    

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def load(filepath: str):
        with open(filepath, "rb") as f:
            return pickle.load(f)