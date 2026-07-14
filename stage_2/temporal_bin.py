import datetime
import torch
import numpy as np

class TemporalBinning:
    def __init__(self, feature_dim=466):
        self.feature_dim = feature_dim
        
        self.bin_names = [
            "Morning_Weekday", "Afternoon_Weekday", "Evening_Weekday",
            "Morning_Weekend", "Afternoon_Weekend", "Evening_Weekend"
        ]
        
        self.clear_buckets = self.clear_buckets 
        self.clear_buckets()

    def clear_buckets(self):
        self.context_buckets = {bin_name: [] for bin_name in self.bin_names}

    def _determine_bin(self, timestamp_str):
        
        dt = None
        
        try:
            dt = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except ValueError:
            try:
                dt = datetime.datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    dt = datetime.datetime.fromisoformat(timestamp_str.replace(' ', 'T').replace('Z', '+00:00'))
                except ValueError:
                    raise ValueError(f"Unrecognized timestamp format string: {timestamp_str}")

        is_weekend = dt.weekday() >= 5
        day_label = "Weekend" if is_weekend else "Weekday"

        hour = dt.hour
        if 5 <= hour < 12:
            time_label = "Morning"
        elif 12 <= hour < 17:
            time_label = "Afternoon"
        else:
            time_label = "Evening"
        return f"{time_label}_{day_label}"

    def route_vector(self, feature_vector, timestamp_str):
        if hasattr(feature_vector, 'shape'):
            incoming_dim = feature_vector.shape[-1]
        elif hasattr(feature_vector, 'size'):
            incoming_dim = feature_vector.size(-1) if callable(feature_vector.size) else feature_vector.size[-1]
        else:
            incoming_dim = len(feature_vector)

        if incoming_dim != self.feature_dim:
            raise ValueError(f"Dimension Mismatch: Expected {self.feature_dim} features, received {incoming_dim}")

        if isinstance(feature_vector, torch.Tensor):
            feature_vector = feature_vector.detach().cpu().numpy()
        elif isinstance(feature_vector, list):
            feature_vector = np.array(feature_vector)
            
        target_bin = self._determine_bin(timestamp_str)
        self.context_buckets[target_bin].append(feature_vector)
        
        return target_bin

    def get_bucket_matrix(self, bin_name):
        vectors = self.context_buckets.get(bin_name, [])
        if not vectors:
            return np.empty((0, self.feature_dim), dtype=np.float32) 
        
        return np.vstack(vectors)