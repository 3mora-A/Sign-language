#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch emotion inference for folders of videos or images.

This utility is meant for dataset-style testing where we want to run the
current emotion model on many files at once and inspect detailed outputs.

Outputs:
- `predictions.csv`: flattened table that is easy to open in Excel.
- `predictions.json`: full per-file records with top predictions.
- `summary.json`: aggregate counts, timing, and optional evaluation metrics.

Optional ground-truth support:
- `--label-source parent-dir`: infer the expected emotion from the parent
  folder name, e.g. `dataset/happy/video01.mp4 -> happy`.
- `--label-source filename-prefix`: infer the expected emotion from the file
  name prefix before the first `-` or `_`, e.g. `angry-eat1.mp4 -> angry`.
- `--label-source manifest`: read expected labels from a CSV manifest.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Iterable


PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
SUPPORTED_EXTENSIONS = VIDEO_EXTENSIONS | IMAGE_EXTENSIONS


def normalize_label(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip().lower()
    return normalized or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run batch emotion prediction on a folder of media files and export detailed reports."
    )
    parser.add_argument(
        "input_path",
        help="Path to one media file or to a folder that contains videos/images.",
    )
    parser.add_argument(
        "--output-dir",
        help="Directory where predictions.csv, predictions.json, and summary.json will be written.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Search subfolders recursively when the input path is a directory.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process only the first N matched files after sorting.",
    )
    parser.add_argument(
        "--num-frames",
        type=int,
        default=10,
        help="Frame budget used by the current video emotion extractor. Default: 10.",
    )
    parser.add_argument(
        "--label-source",
        choices=["none", "parent-dir", "filename-prefix", "manifest"],
        default="none",
        help="How to resolve the expected emotion label for evaluation metrics.",
    )
    parser.add_argument(
        "--manifest",
        help="CSV file used with --label-source manifest.",
    )
    parser.add_argument(
        "--manifest-file-column",
        default="filename",
        help="Manifest CSV column that contains the file name or relative path. Default: filename.",
    )
    parser.add_argument(
        "--manifest-label-column",
        default="emotion",
        help="Manifest CSV column that contains the expected emotion label. Default: emotion.",
    )
    return parser.parse_args()


def ensure_output_dir(path_arg: str | None) -> Path:
    if path_arg:
        output_dir = Path(path_arg).expanduser().resolve()
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = PROJECT_DIR / "runtime" / "reports" / f"emotion_batch_{stamp}"

    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def collect_media_files(input_path: Path, recursive: bool) -> list[Path]:
    if not input_path.exists():
        raise FileNotFoundError(f"Input path was not found: {input_path}")

    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported media file type: {input_path.suffix}")
        return [input_path.resolve()]

    iterator: Iterable[Path]
    iterator = input_path.rglob("*") if recursive else input_path.glob("*")
    files = sorted(
        item.resolve()
        for item in iterator
        if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not files:
        raise ValueError(f"No supported media files were found under: {input_path}")

    return files


def load_manifest_map(
    manifest_path: str | None,
    file_column: str,
    label_column: str,
) -> dict[str, str]:
    if not manifest_path:
        raise ValueError("--manifest is required when --label-source manifest is used")

    manifest_file = Path(manifest_path).expanduser().resolve()
    if not manifest_file.is_file():
        raise FileNotFoundError(f"Manifest CSV was not found: {manifest_file}")

    mapping: dict[str, str] = {}
    with manifest_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if file_column not in (reader.fieldnames or []):
            raise ValueError(f"Manifest column was not found: {file_column}")
        if label_column not in (reader.fieldnames or []):
            raise ValueError(f"Manifest column was not found: {label_column}")

        for row in reader:
            file_value = (row.get(file_column) or "").strip()
            label_value = normalize_label(row.get(label_column))
            if not file_value or not label_value:
                continue

            key = file_value.replace("\\", "/").strip().lower()
            mapping[key] = label_value
            mapping[Path(file_value).name.lower()] = label_value

    if not mapping:
        raise ValueError("The manifest CSV did not contain any usable file/label rows")

    return mapping


def resolve_expected_label(
    media_path: Path,
    root_path: Path,
    label_source: str,
    manifest_map: dict[str, str] | None,
) -> str | None:
    if label_source == "none":
        return None

    if label_source == "parent-dir":
        if media_path == root_path:
            return None
        if root_path.is_dir() and media_path.parent == root_path:
            return None
        return normalize_label(media_path.parent.name)

    if label_source == "manifest":
        if not manifest_map:
            return None

        relative_key = None
        if root_path.is_dir():
            try:
                relative_key = media_path.relative_to(root_path).as_posix().lower()
            except ValueError:
                relative_key = media_path.name.lower()
        else:
            relative_key = media_path.name.lower()

        return manifest_map.get(relative_key) or manifest_map.get(media_path.name.lower())

    if label_source == "filename-prefix":
        stem = media_path.stem.strip()
        if not stem:
            return None

        for separator in ("-", "_"):
            if separator in stem:
                return normalize_label(stem.split(separator, 1)[0])

        return normalize_label(stem)

    return None


def build_csv_row(record: dict) -> dict[str, object]:
    return {
        "index": record["index"],
        "filename": record["filename"],
        "expected_emotion": record["expected_emotion"],
        "predicted_emotion": record["predicted_emotion"],
        "emotion_confidence": record["emotion_confidence"],
        "processing_time_ms": record["processing_time_ms"],
        "correct": record["correct"],
        "error": record["error"],
    }


def write_csv_report(records: list[dict], output_file: Path) -> None:
    rows = [build_csv_row(record) for record in records]
    fieldnames = [
        "index",
        "filename",
        "expected_emotion",
        "predicted_emotion",
        "emotion_confidence",
        "processing_time_ms",
        "correct",
        "error",
    ]

    with output_file.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_summary(
    records: list[dict],
    input_path: Path,
    output_dir: Path,
    started_at_iso: str,
    finished_at_iso: str,
    num_frames: int,
    label_source: str,
    model_classes: list[str],
) -> dict:
    successful = [record for record in records if record["status"] == "success"]
    failed = [record for record in records if record["status"] != "success"]
    durations = [float(record["processing_time_ms"]) for record in records if record["processing_time_ms"] is not None]
    predicted_counts = Counter(
        record["predicted_emotion"] for record in successful if record["predicted_emotion"]
    )

    summary = {
        "input_path": str(input_path),
        "output_dir": str(output_dir),
        "started_at": started_at_iso,
        "finished_at": finished_at_iso,
        "total_files": len(records),
        "successful": len(successful),
        "failed": len(failed),
        "num_frames_requested": int(num_frames),
        "label_source": label_source,
        "model_classes": model_classes,
        "average_processing_time_ms": round(sum(durations) / len(durations), 2) if durations else None,
        "max_processing_time_ms": round(max(durations), 2) if durations else None,
        "min_processing_time_ms": round(min(durations), 2) if durations else None,
        "predicted_emotion_counts": dict(sorted(predicted_counts.items())),
        "report_files": {
            "csv": str(output_dir / "predictions.csv"),
            "json": str(output_dir / "predictions.json"),
            "summary": str(output_dir / "summary.json"),
        },
    }

    labeled_records = [
        record
        for record in successful
        if record["expected_emotion"] and record["predicted_emotion"]
    ]

    if labeled_records:
        from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

        y_true = [record["expected_emotion"] for record in labeled_records]
        y_pred = [record["predicted_emotion"] for record in labeled_records]
        labels = sorted(set(model_classes) | set(y_true) | set(y_pred))

        summary["evaluation"] = {
            "labeled_samples": len(labeled_records),
            "correct_predictions": int(sum(1 for actual, pred in zip(y_true, y_pred) if actual == pred)),
            "accuracy": round(float(accuracy_score(y_true, y_pred)) * 100, 2),
            "classification_report": classification_report(
                y_true,
                y_pred,
                labels=labels,
                output_dict=True,
                zero_division=0,
            ),
            "confusion_matrix": {
                "labels": labels,
                "matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
            },
        }

    return summary


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    args = parse_args()

    try:
        from emotion import EmotionModule, extract_vector_from_media_path, load_feature_extractor
    except ImportError as exc:
        missing_module = getattr(exc, "name", None) or str(exc)
        raise SystemExit(
            "Missing Python dependency while starting batch emotion prediction: "
            f"{missing_module}. Activate the python-api virtual environment and run "
            "'pip install -r requirements.txt' first."
        ) from exc

    try:
        from tqdm import tqdm
    except ImportError:
        def tqdm(iterable, **_kwargs):
            return iterable

    input_path = Path(args.input_path).expanduser().resolve()
    output_dir = ensure_output_dir(args.output_dir)
    media_files = collect_media_files(input_path, recursive=args.recursive)
    if args.limit is not None:
        media_files = media_files[: max(0, args.limit)]

    if not media_files:
        raise ValueError("No media files are available after applying --limit")

    manifest_map = None
    if args.label_source == "manifest":
        manifest_map = load_manifest_map(
            manifest_path=args.manifest,
            file_column=args.manifest_file_column,
            label_column=args.manifest_label_column,
        )

    emotion_module = EmotionModule()
    if not emotion_module.loaded:
        raise RuntimeError("Emotion model files were not found")

    feature_extractor = load_feature_extractor()
    model_classes = sorted(str(item).lower() for item in getattr(emotion_module.label_encoder, "classes_", []))

    started_at = datetime.now().astimezone()
    records: list[dict] = []

    for index, media_path in enumerate(tqdm(media_files, desc="Emotion batch test", unit="file"), start=1):
        per_file_started = time.perf_counter()
        suffix = media_path.suffix.lower()
        expected_emotion = resolve_expected_label(
            media_path=media_path,
            root_path=input_path,
            label_source=args.label_source,
            manifest_map=manifest_map,
        )

        try:
            result = emotion_module.predict_from_raw_vector(
                extract_vector_from_media_path(
                    media_path,
                    feature_extractor,
                    num_frames=max(1, int(args.num_frames)),
                )
            )
            elapsed_ms = round((time.perf_counter() - per_file_started) * 1000, 2)
            predicted_emotion = normalize_label(result.get("emotion"))

            relative_path = media_path.name
            if input_path.is_dir():
                relative_path = media_path.relative_to(input_path).as_posix()

            records.append(
                {
                    "index": index,
                    "status": "success",
                    "filename": media_path.name,
                    "relative_path": relative_path,
                    "absolute_path": str(media_path),
                    "media_type": "image" if suffix in IMAGE_EXTENSIONS else "video",
                    "inference_mode": "image_single_frame" if suffix in IMAGE_EXTENSIONS else "video_keyframe",
                    "expected_emotion": expected_emotion,
                    "predicted_emotion": predicted_emotion,
                    "emotion_confidence": result.get("emotion_confidence"),
                    "emotion_confidence_raw": result.get("emotion_confidence_raw"),
                    "emotion_input_features": result.get("emotion_input_features"),
                    "num_frames_requested": int(args.num_frames),
                    "processing_time_ms": elapsed_ms,
                    "correct": predicted_emotion == expected_emotion if expected_emotion else None,
                    "top_predictions": result.get("emotion_top_predictions", []),
                    "error": None,
                }
            )
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - per_file_started) * 1000, 2)

            relative_path = media_path.name
            if input_path.is_dir():
                relative_path = media_path.relative_to(input_path).as_posix()

            records.append(
                {
                    "index": index,
                    "status": "error",
                    "filename": media_path.name,
                    "relative_path": relative_path,
                    "absolute_path": str(media_path),
                    "media_type": "image" if suffix in IMAGE_EXTENSIONS else "video",
                    "inference_mode": "image_single_frame" if suffix in IMAGE_EXTENSIONS else "video_keyframe",
                    "expected_emotion": expected_emotion,
                    "predicted_emotion": None,
                    "emotion_confidence": None,
                    "emotion_confidence_raw": None,
                    "emotion_input_features": None,
                    "num_frames_requested": int(args.num_frames),
                    "processing_time_ms": elapsed_ms,
                    "correct": None,
                    "top_predictions": [],
                    "error": str(exc),
                }
            )

    finished_at = datetime.now().astimezone()

    predictions_json_path = output_dir / "predictions.json"
    summary_json_path = output_dir / "summary.json"
    predictions_csv_path = output_dir / "predictions.csv"

    summary = build_summary(
        records=records,
        input_path=input_path,
        output_dir=output_dir,
        started_at_iso=started_at.isoformat(),
        finished_at_iso=finished_at.isoformat(),
        num_frames=args.num_frames,
        label_source=args.label_source,
        model_classes=model_classes,
    )

    with predictions_json_path.open("w", encoding="utf-8") as handle:
        json.dump(records, handle, ensure_ascii=False, indent=2)

    with summary_json_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    write_csv_report(records, predictions_csv_path)

    print(f"Processed files: {summary['total_files']}")
    print(f"Successful: {summary['successful']}")
    print(f"Failed: {summary['failed']}")
    if summary.get("evaluation"):
        print(f"Accuracy: {summary['evaluation']['accuracy']:.2f}%")
    print(f"CSV report: {predictions_csv_path}")
    print(f"JSON details: {predictions_json_path}")
    print(f"Summary: {summary_json_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
