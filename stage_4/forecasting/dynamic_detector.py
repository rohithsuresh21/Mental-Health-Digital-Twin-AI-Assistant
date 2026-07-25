import pickle
import os
from typing import List

# Simple placeholder functions for dynamic change detector module
def save_detector(obj, path: str) -> None:
	"""Save detector object to a file using pickle."""
	os.makedirs(os.path.dirname(path), exist_ok=True)
	with open(path, "wb") as f:
		pickle.dump(obj, f)

def load_detector(path: str):
	"""Load detector object from a pickle file."""
	with open(path, "rb") as f:
		return pickle.load(f)

__all__ = ["save_detector", "load_detector"]