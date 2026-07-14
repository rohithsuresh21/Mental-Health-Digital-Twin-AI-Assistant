
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data_loader import DAICWOZLoader
from data_processor import Stage4DataProcessor
from calibration import Stage4DetectorCalibration

DAIC_PATH = r"E:\DAIC-WOZ"

def main():
    print("STAGE 4 DETECTOR CALIBRATION — DAIC-WOZ")

    print("\n[STEP 1] Loading DAIC-WOZ data...")
    try:
        daic_loader = DAICWOZLoader(DAIC_PATH)
        all_records = daic_loader.load_transcripts()
    except Exception as e:
        print(f"Error loading DAIC: {e}")
        return

    print(f"\nTotal records loaded: {len(all_records)}")

    if len(all_records) == 0:
        print("\nNo records loaded. Check that E:\\DAIC-WOZ contains:")
        print("  Other/train_split_Depression_AVEC2017.csv")
        print("  Train/High/319_P/319_TRANSCRIPT.csv (and similar)")
        return

    print("\n[STEP 2] Processing through Stages 1-2...")
    processor = Stage4DataProcessor()
    vectors = processor.process_records(all_records)

    total = len(vectors["healthy"]) + len(vectors["atrisk"])
    if total == 0:
        print("\nNo vectors extracted.")
        return

    print("\n[STEP 3] Saving extracted vectors...")
    data_dir = processor.save_vectors(vectors, output_dir="./daic_processed")

    print("\n[STEP 4] Calibrating detectors...")
    calibrator = Stage4DetectorCalibration(str(data_dir))
    calibrator.load_vectors()

    calibrator.calibrate_mahalanobis()
    calibrator.calibrate_copula()
    calibrator.calibrate_isolation_forest()
    calibrator.calibrate_knn()

    print("\n[STEP 5] Saving calibrated models and threshold engine...")
    model_dir = calibrator.save_calibration()

    print("\nCALIBRATION COMPLETE!")
    print(f"\nModels saved to: {model_dir}")
    print("  stage4_detectors.pkl        — four fitted detector objects")
    print("  stage4_threshold_engine.pkl — 95th-percentile thresholds per detector")
    print("  detector_statistics.json    — separation metrics per detector")

if __name__ == "__main__":
    main()